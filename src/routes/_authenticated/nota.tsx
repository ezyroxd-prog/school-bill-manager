import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { Receipt as ReceiptIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/nota")({
  component: ReceiptsPage,
});

function ReceiptsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("receipts")
        .select("id, receipt_number, issued_at, payment:payments(amount, payment_type), invoice:invoices(name, invoice_number, student:students(full_name))")
        .order("issued_at", { ascending: false });
      setRows(data ?? []);
    })();
  }, []);

  return (
    <>
      <PageHeader title="Nota Pembayaran" description="Riwayat nota pembayaran lunas" />
      <div className="grid gap-3">
        {rows.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground"><ReceiptIcon className="size-8 mx-auto mb-2 opacity-50" />Belum ada nota.</CardContent></Card>}
        {rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="font-mono text-xs text-muted-foreground">{r.receipt_number}</div>
                <div className="font-medium">{r.invoice?.name}</div>
                <div className="text-sm text-muted-foreground">{r.invoice?.student?.full_name} · {formatDateTime(r.issued_at)}</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{formatRupiah(r.payment?.amount)}</div>
                <div className="text-xs text-muted-foreground">{r.payment?.payment_type ?? "-"}</div>
              </div>
              <Link to="/nota/$id" params={{ id: r.id }}>
                <Button variant="outline">Lihat & Cetak</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
