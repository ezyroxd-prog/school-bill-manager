import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { formatRupiah, formatDate } from "@/lib/format";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/laporan")({
  component: ReportsPage,
});

function ReportsPage() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: i }] = await Promise.all([
        supabase.from("payments").select("amount, paid_at, payment_type, invoice:invoices(name, billing_type:billing_types(name), student:students(full_name, class:classes(name)))")
          .in("transaction_status", ["settlement", "capture"])
          .gte("paid_at", from)
          .lte("paid_at", to + "T23:59:59"),
        supabase.from("invoices").select("amount, paid_amount, status, student:students(full_name, class:classes(name))").neq("status", "paid"),
      ]);
      setPayments(p ?? []); setInvoices(i ?? []);
    })();
  }, [from, to]);

  const totals = useMemo(() => {
    const total = payments.reduce((a, p) => a + Number(p.amount || 0), 0);
    const byClass = new Map<string, number>();
    const byType = new Map<string, number>();
    const byDay = new Map<string, number>();
    for (const p of payments) {
      const cls = p.invoice?.student?.class?.name ?? "Tanpa Kelas";
      byClass.set(cls, (byClass.get(cls) ?? 0) + Number(p.amount));
      const t = p.invoice?.billing_type?.name ?? p.invoice?.name ?? "Lainnya";
      byType.set(t, (byType.get(t) ?? 0) + Number(p.amount));
      const d = (p.paid_at ?? "").slice(0, 10);
      if (d) byDay.set(d, (byDay.get(d) ?? 0) + Number(p.amount));
    }
    const chart = Array.from(byDay.entries()).sort().map(([date, total]) => ({ date: formatDate(date), total }));
    const tunggakan = invoices.reduce((a, i) => a + (Number(i.amount) - Number(i.paid_amount || 0)), 0);
    return { total, byClass: Array.from(byClass.entries()), byType: Array.from(byType.entries()), chart, tunggakan };
  }, [payments, invoices]);

  function exportCSV() {
    const rows = [
      ["Tanggal", "Siswa", "Kelas", "Jenis", "Nominal"].join(","),
      ...payments.map((p) => [
        (p.paid_at ?? "").slice(0, 10),
        `"${p.invoice?.student?.full_name ?? ""}"`,
        `"${p.invoice?.student?.class?.name ?? ""}"`,
        `"${p.invoice?.billing_type?.name ?? p.invoice?.name ?? ""}"`,
        p.amount,
      ].join(",")),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `laporan-${from}-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader title="Laporan Keuangan" description="Pemasukan, rekap per kelas/jenis tagihan, dan tunggakan" action={<Button onClick={exportCSV}><Download className="size-4 mr-2" /> Export CSV</Button>} />

      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1.5"><Label>Dari</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Sampai</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Total Pemasukan</div><div className="text-2xl font-bold mt-1">{formatRupiah(totals.total)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Total Transaksi</div><div className="text-2xl font-bold mt-1">{payments.length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-sm text-muted-foreground">Total Tunggakan</div><div className="text-2xl font-bold mt-1 text-destructive">{formatRupiah(totals.tunggakan)}</div></CardContent></Card>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Pemasukan Harian</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={totals.chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => v >= 1_000_000 ? `${v/1_000_000}jt` : `${v/1000}rb`} />
                <Tooltip formatter={(v: number) => formatRupiah(v)} />
                <Line type="monotone" dataKey="total" stroke="oklch(0.55 0.15 150)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Rekap per Kelas</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {totals.byClass.map(([k, v]) => <tr key={k} className="border-b last:border-0"><td className="py-2">{k}</td><td className="text-right font-medium">{formatRupiah(v)}</td></tr>)}
                {totals.byClass.length === 0 && <tr><td className="py-2 text-muted-foreground">Tidak ada data</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Rekap per Jenis Tagihan</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {totals.byType.map(([k, v]) => <tr key={k} className="border-b last:border-0"><td className="py-2">{k}</td><td className="text-right font-medium">{formatRupiah(v)}</td></tr>)}
                {totals.byType.length === 0 && <tr><td className="py-2 text-muted-foreground">Tidak ada data</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
