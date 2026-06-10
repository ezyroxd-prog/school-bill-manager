import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { ArrowLeft, Printer, CheckCircle2 } from "lucide-react";
import logo from "@/assets/school-logo.png";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/nota/$id")({
  component: ReceiptDetail,
});

function ReceiptDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [r, setR] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("receipts")
        .select("*, payment:payments(amount, payment_type, paid_at, order_id), invoice:invoices(name, invoice_number, amount, student:students(full_name, nis, class:classes(name), parent:profiles(full_name)))")
        .eq("id", id).maybeSingle();
      setR(data);
    })();
  }, [id]);

  if (!r) return <p className="text-muted-foreground p-6">Memuat…</p>;

  const verifyUrl = `${window.location.origin}/verify/${r.verification_code}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verifyUrl)}`;

  return (
    <div>
      <div className="flex justify-between mb-4 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/nota" })}><ArrowLeft className="size-4 mr-2" /> Kembali</Button>
        <Button onClick={() => window.print()}><Printer className="size-4 mr-2" /> Cetak / Download PDF</Button>
      </div>

      <div className="mx-auto max-w-2xl bg-white text-foreground rounded-lg border p-8 print:border-0 print:shadow-none print:max-w-full">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" width={48} height={48} />
            <div>
              <div className="font-bold">Sekolah Alam Al-Karim</div>
              <div className="text-xs text-muted-foreground">SAAPayment</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">No. Nota</div>
            <div className="font-mono font-semibold">{r.receipt_number}</div>
          </div>
        </div>

        <h2 className="text-center text-lg font-bold mt-6">NOTA PEMBAYARAN</h2>

        <div className="grid grid-cols-2 gap-4 mt-6 text-sm">
          <div><div className="text-muted-foreground">Nama Siswa</div><div className="font-medium">{r.invoice?.student?.full_name}</div></div>
          <div><div className="text-muted-foreground">NIS</div><div className="font-medium">{r.invoice?.student?.nis}</div></div>
          <div><div className="text-muted-foreground">Kelas</div><div className="font-medium">{r.invoice?.student?.class?.name ?? "-"}</div></div>
          <div><div className="text-muted-foreground">Orang Tua</div><div className="font-medium">{r.invoice?.student?.parent?.full_name ?? "-"}</div></div>
          <div><div className="text-muted-foreground">Tanggal Bayar</div><div className="font-medium">{formatDateTime(r.payment?.paid_at)}</div></div>
          <div><div className="text-muted-foreground">Metode</div><div className="font-medium">{r.payment?.payment_type ?? "-"}</div></div>
        </div>

        <table className="w-full text-sm mt-6 border-t border-b">
          <thead className="text-left"><tr><th className="py-2">Keterangan</th><th className="text-right">Jumlah</th></tr></thead>
          <tbody>
            <tr><td className="py-2">{r.invoice?.name}</td><td className="text-right">{formatRupiah(r.payment?.amount)}</td></tr>
          </tbody>
          <tfoot><tr className="font-bold border-t"><td className="py-2">Total Dibayar</td><td className="text-right">{formatRupiah(r.payment?.amount)}</td></tr></tfoot>
        </table>

        <div className="mt-6 flex items-end justify-between">
          <div className="flex items-center gap-2 text-[color:var(--success)]">
            <CheckCircle2 className="size-6" />
            <div>
              <div className="font-bold">LUNAS</div>
              <div className="text-xs text-muted-foreground">Pembayaran terverifikasi</div>
            </div>
          </div>
          <div className="text-center">
            <img src={qrSrc} alt="QR Verifikasi" width={120} height={120} className="border rounded" />
            <div className="text-[10px] text-muted-foreground mt-1 font-mono">{r.verification_code}</div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Nota digital ini sah tanpa tanda tangan. Verifikasi keaslian dengan memindai QR di atas.
        </p>
      </div>

      <style>{`@media print { body { background: white; } aside, header { display: none !important; } main { padding: 0 !important; } }`}</style>
    </div>
  );
}
