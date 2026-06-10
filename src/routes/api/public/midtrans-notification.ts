import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

export const Route = createFileRoute("/api/public/midtrans-notification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, payment_type, transaction_id } = body;

          const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
          const expected = createHash("sha512")
            .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
            .digest("hex");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (expected !== signature_key) {
            await supabaseAdmin.from("activity_logs").insert({
              action: "midtrans_invalid_signature",
              entity: "payment",
              entity_id: order_id,
              metadata: body,
            });
            return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { "Content-Type": "application/json" } });
          }

          // Find payment
          const { data: payment } = await supabaseAdmin
            .from("payments")
            .select("id, invoice_id, amount")
            .eq("order_id", order_id)
            .maybeSingle();

          if (!payment) {
            return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
          }

          // Map status
          let mapped = transaction_status as string;
          if (transaction_status === "capture" && fraud_status === "challenge") mapped = "pending";

          const validStatuses = ["pending", "settlement", "capture", "expire", "cancel", "deny", "failure", "refund"];
          if (!validStatuses.includes(mapped)) mapped = "pending";

          const isSuccess = mapped === "settlement" || (mapped === "capture" && fraud_status !== "deny");

          await supabaseAdmin.from("payments").update({
            transaction_status: mapped as "pending" | "settlement" | "capture" | "expire" | "cancel" | "deny" | "failure" | "refund",
            fraud_status: fraud_status ?? null,
            payment_type: payment_type ?? null,
            transaction_id: transaction_id ?? null,
            raw_response: body,
            paid_at: isSuccess ? new Date().toISOString() : null,
          }).eq("id", payment.id);

          if (isSuccess) {
            // Update invoice
            const { data: inv } = await supabaseAdmin.from("invoices").select("amount, paid_amount, student_id").eq("id", payment.invoice_id).maybeSingle();
            if (inv) {
              const newPaid = Number(inv.paid_amount || 0) + Number(payment.amount);
              const status = newPaid >= Number(inv.amount) ? "paid" : "partial";
              await supabaseAdmin.from("invoices").update({ paid_amount: newPaid, status }).eq("id", payment.invoice_id);

              // Create receipt if paid
              if (status === "paid") {
                const receiptNumber = `NOTA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${order_id.slice(-6)}`;
                await supabaseAdmin.from("receipts").insert({
                  receipt_number: receiptNumber,
                  payment_id: payment.id,
                  invoice_id: payment.invoice_id,
                });

                // Notify parent
                const { data: studentRow } = await supabaseAdmin.from("students").select("parent_id, full_name").eq("id", inv.student_id).maybeSingle();
                if (studentRow?.parent_id) {
                  await supabaseAdmin.from("notifications").insert({
                    user_id: studentRow.parent_id,
                    title: "Pembayaran Berhasil",
                    body: `Pembayaran untuk ${studentRow.full_name} telah berhasil. Nota tersedia di akun Anda.`,
                    link: "/nota",
                  });
                }
              }
            }
          }

          await supabaseAdmin.from("activity_logs").insert({
            action: "midtrans_notification",
            entity: "payment",
            entity_id: order_id,
            metadata: { status: mapped, fraud_status, payment_type },
          });

          return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          console.error("Midtrans webhook error:", e);
          return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
