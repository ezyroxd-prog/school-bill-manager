import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentTransaction, getMidtransClientKey, syncPaymentStatus } from "@/lib/payments.functions";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRupiah, formatDate, formatDateTime, INVOICE_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Receipt as ReceiptIcon, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tagihan/$id")({
  component: InvoiceDetail,
});

declare global {
  interface Window {
    snap?: { pay: (token: string, opts?: Record<string, (r: any) => void>) => void };
  }
}

function InvoiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [paying, setPaying] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [snapReady, setSnapReady] = useState(false);

  const payFn = useServerFn(createPaymentTransaction);
  const keyFn = useServerFn(getMidtransClientKey);
  const syncFn = useServerFn(syncPaymentStatus);

  async function loadData() {
    const [{ data: inv }, { data: pays }] = await Promise.all([
      supabase.from("invoices").select("*, student:students(full_name, class:classes(name)), billing_type:billing_types(name)").eq("id", id).maybeSingle(),
      supabase.from("payments").select("*").eq("invoice_id", id).order("created_at", { ascending: false }),
    ]);
    setInvoice(inv);
    setPayments(pays ?? []);
  }

  useEffect(() => {
    loadData();
  }, [id]);

  useEffect(() => {
    (async () => {
      const { client_key } = await keyFn();
      if (!client_key) return;
      if (document.getElementById("midtrans-snap")) {
        setSnapReady(true);
        return;
      }
      const s = document.createElement("script");
      s.id = "midtrans-snap";
      s.src = "https://app.sandbox.midtrans.com/snap/snap.js";
      s.setAttribute("data-client-key", client_key);
      s.onload = () => setSnapReady(true);
      document.body.appendChild(s);
    })();
  }, [keyFn]);

  async function pay() {
    setPaying(true);
    try {
      const res = await payFn({ data: { invoice_id: id } });
      if (window.snap && res.snap_token) {
        window.snap.pay(res.snap_token, {
          onSuccess: async () => { 
            toast.success("Pembayaran berhasil"); 
            try { await syncFn({ data: { order_id: res.order_id } }); } catch (e) {}
            setTimeout(() => location.reload(), 1500); 
          },
          onPending: () => { toast.info("Pembayaran tertunda, menunggu konfirmasi."); setTimeout(() => location.reload(), 1500); },
          onError: (r: any) => { toast.error("Pembayaran gagal"); },
          onClose: () => toast.info("Pembayaran dibatalkan"),
        });
      } else if (res.redirect_url) {
        window.open(res.redirect_url, "_blank");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Gagal memproses pembayaran");
    } finally { setPaying(false); }
  }

  async function handleSync(orderId: string) {
    setSyncing(orderId);
    try {
      const res = await syncFn({ data: { order_id: orderId } });
      toast.success(res.message);
      await loadData();
    } catch (e: any) {
      toast.error(e.message ?? "Gagal sinkronisasi status");
    } finally {
      setSyncing(null);
    }
  }

  if (!invoice) return <p className="text-muted-foreground">Memuat…</p>;
  const sisa = Number(invoice.amount) - Number(invoice.paid_amount || 0);
  const isPaid = invoice.status === "paid";

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/tagihan" })}><ArrowLeft className="size-4 mr-2" /> Kembali</Button>
      <PageHeader title={invoice.name} description={`No. ${invoice.invoice_number}`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <Row label="Siswa" value={invoice.student?.full_name} />
            <Row label="Kelas" value={invoice.student?.class?.name ?? "-"} />
            <Row label="Jenis Tagihan" value={invoice.billing_type?.name ?? "-"} />
            <Row label="Jatuh Tempo" value={formatDate(invoice.due_date)} />
            <Row label="Keterangan" value={invoice.description ?? "-"} />
            <Row label="Status" value={INVOICE_STATUS_LABEL[invoice.status]} />
            <hr />
            <Row label="Nominal Tagihan" value={formatRupiah(invoice.amount)} />
            <Row label="Sudah Dibayar" value={formatRupiah(invoice.paid_amount || 0)} />
            <Row label="Sisa Tagihan" value={<strong>{formatRupiah(sisa)}</strong>} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-3">
            {isPaid ? (
              <>
                <p className="text-sm text-muted-foreground">Tagihan ini sudah lunas.</p>
                <Button asChild className="w-full"><a href={`/nota?invoice=${invoice.id}`}><ReceiptIcon className="size-4 mr-2" /> Lihat Nota</a></Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Bayar via Midtrans (VA, QRIS, e-wallet, kartu).</p>
                <Button className="w-full" onClick={pay} disabled={paying || !snapReady}>
                  {paying ? "Memproses…" : snapReady ? "Bayar Sekarang" : "Memuat pembayaran…"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {payments.length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3">Riwayat Pembayaran</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="py-2">Order ID</th><th>Metode</th><th>Status</th><th>Waktu</th><th className="text-right">Nominal</th><th></th></tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{p.order_id}</td>
                    <td>{p.payment_type ?? "-"}</td>
                    <td>{PAYMENT_STATUS_LABEL[p.transaction_status] ?? p.transaction_status}</td>
                    <td>{formatDateTime(p.paid_at ?? p.created_at)}</td>
                    <td className="text-right">{formatRupiah(p.amount)}</td>
                    <td className="text-right pl-2">
                      {p.transaction_status === "pending" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleSync(p.order_id)}
                          disabled={syncing === p.order_id}
                          title="Cek & Sinkronkan Status Pembayaran"
                        >
                          <RefreshCw className={`size-3 ${syncing === p.order_id ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
