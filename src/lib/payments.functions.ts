import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MIDTRANS_API_SANDBOX = "https://app.sandbox.midtrans.com/snap/v1/transactions";

const createPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
});

export const createPaymentTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createPaymentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch invoice with student & parent — RLS ensures parent can only access their own
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, invoice_number, name, amount, paid_amount, status, student:students(full_name, parent_id, parent_whatsapp)")
      .eq("id", data.invoice_id)
      .maybeSingle();

    if (invErr || !invoice) throw new Error("Tagihan tidak ditemukan");
    if (invoice.status === "paid") throw new Error("Tagihan sudah lunas");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const student = invoice.student as any;

    // Debug: log parent check
    console.log("[Payment] userId:", userId, "student.parent_id:", student?.parent_id);

    // Jika parent_id sudah diset, harus cocok dengan user yang login
    if (student?.parent_id && student.parent_id !== userId) {
      throw new Error(`Tidak diizinkan: tagihan bukan milik Anda`);
    }
    if (!student?.parent_id) {
      console.warn("[Payment] PERINGATAN: student.parent_id kosong");
    }

    const remaining = Number(invoice.amount) - Number(invoice.paid_amount || 0);
    if (remaining <= 0) throw new Error("Tidak ada nominal yang perlu dibayar");

    const { data: profile } = await supabase.from("profiles").select("full_name, email, phone").eq("id", userId).maybeSingle();

    const orderId = `${invoice.invoice_number}-${Date.now().toString(36).toUpperCase()}`;

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    console.log("[Payment] MIDTRANS_SERVER_KEY:", serverKey ? "ADA" : "KOSONG");
    if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi");

    const authHeader = "Basic " + Buffer.from(serverKey + ":").toString("base64");

    const payload = {
      transaction_details: { order_id: orderId, gross_amount: Math.round(remaining) },
      item_details: [{ id: invoice.id, name: `${invoice.name} - ${student?.full_name ?? ""}`.slice(0, 50), price: Math.round(remaining), quantity: 1 }],
      customer_details: {
        first_name: profile?.full_name || "Wali Murid",
        email: profile?.email || undefined,
        phone: profile?.phone || student?.parent_whatsapp || undefined,
      },
      credit_card: { secure: true },
    };

    console.log("[Payment] mengirim ke Midtrans, orderId:", orderId);
    const res = await fetch(MIDTRANS_API_SANDBOX, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: authHeader },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    console.log("[Payment] respons Midtrans status:", res.status, JSON.stringify(result));
    if (!res.ok) throw new Error(result?.error_messages?.join(", ") || "Gagal membuat transaksi Midtrans");

    // Use admin client to insert payment row (bypass RLS for insert)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: payErr } = await supabaseAdmin.from("payments").insert({
      order_id: orderId,
      invoice_id: invoice.id,
      amount: Math.round(remaining),
      transaction_status: "pending",
      snap_token: result.token,
      snap_redirect_url: result.redirect_url,
    });
    if (payErr) throw new Error(payErr.message);

    return { snap_token: result.token as string, redirect_url: result.redirect_url as string, order_id: orderId };
  });

export const getMidtransClientKey = createServerFn({ method: "GET" }).handler(async () => {
  return { client_key: process.env.MIDTRANS_CLIENT_KEY ?? "", is_production: false };
});

export const syncPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ order_id: z.string() }))
  .handler(async ({ data }) => {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi");

    const authHeader = "Basic " + Buffer.from(serverKey + ":").toString("base64");
    const res = await fetch(`https://api.sandbox.midtrans.com/v2/${data.order_id}/status`, {
      headers: { Accept: "application/json", Authorization: authHeader },
    });
    
    if (!res.ok && res.status !== 404) {
      throw new Error("Gagal mengecek status ke Midtrans");
    }
    
    const body = await res.json();
    if (body.status_code === "404") {
      return { status: "pending", message: "Transaksi belum ada di Midtrans" };
    }

    const { transaction_status, fraud_status, payment_type, transaction_id } = body;
    
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Find payment
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, invoice_id, amount, transaction_status")
      .eq("order_id", data.order_id)
      .maybeSingle();

    if (!payment) throw new Error("Payment not found in database");
    if (payment.transaction_status === "settlement" || payment.transaction_status === "capture") {
       return { status: payment.transaction_status, message: "Sudah lunas sebelumnya" };
    }

    // Map status
    let mapped = transaction_status as string;
    if (transaction_status === "capture" && fraud_status === "challenge") mapped = "pending";

    const validStatuses = ["pending", "settlement", "capture", "expire", "cancel", "deny", "failure", "refund"];
    if (!validStatuses.includes(mapped)) mapped = "pending";

    const isSuccess = mapped === "settlement" || (mapped === "capture" && fraud_status !== "deny");

    await supabaseAdmin.from("payments").update({
      transaction_status: mapped as any,
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
          const receiptNumber = `NOTA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${data.order_id.slice(-6)}`;
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

    return { status: mapped, message: "Berhasil disinkronkan" };
  });
