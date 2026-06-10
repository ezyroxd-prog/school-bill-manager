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
    if (student?.parent_id !== userId) throw new Error("Tidak diizinkan");

    const remaining = Number(invoice.amount) - Number(invoice.paid_amount || 0);
    if (remaining <= 0) throw new Error("Tidak ada nominal yang perlu dibayar");

    const { data: profile } = await supabase.from("profiles").select("full_name, email, phone").eq("id", userId).maybeSingle();

    const orderId = `${invoice.invoice_number}-${Date.now().toString(36).toUpperCase()}`;

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
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

    const res = await fetch(MIDTRANS_API_SANDBOX, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: authHeader },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
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
