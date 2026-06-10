import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { formatRupiah, formatDateTime, PAYMENT_STATUS_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pembayaran")({
  component: PaymentsAdmin,
});

function PaymentsAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<"all" | "day" | "week" | "month" | "year">("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("payments")
        .select("*, invoice:invoices(invoice_number, name, student:students(full_name, class:classes(name), parent:profiles(full_name)))")
        .order("created_at", { ascending: false }).limit(500);
      setRows(data ?? []);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (period !== "all") {
      const now = new Date();
      const d = new Date(r.paid_at ?? r.created_at);
      const diffDays = (now.getTime() - d.getTime()) / 86400000;
      if (period === "day" && diffDays > 1) return false;
      if (period === "week" && diffDays > 7) return false;
      if (period === "month" && diffDays > 31) return false;
      if (period === "year" && diffDays > 365) return false;
    }
    const q = search.toLowerCase();
    return !q || r.order_id?.toLowerCase().includes(q) || r.invoice?.student?.full_name?.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader title="Manajemen Pembayaran" description="Riwayat transaksi pembayaran via Midtrans" />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari order ID atau siswa…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua</SelectItem>
            <SelectItem value="day">Hari Ini</SelectItem>
            <SelectItem value="week">7 Hari</SelectItem>
            <SelectItem value="month">30 Hari</SelectItem>
            <SelectItem value="year">1 Tahun</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="px-4 py-2">Order ID</th><th className="px-4 py-2">Siswa</th><th className="px-4 py-2">Orang Tua</th><th className="px-4 py-2">Tagihan</th><th className="px-4 py-2">Metode</th><th className="px-4 py-2">Waktu</th><th className="px-4 py-2 text-right">Nominal</th><th className="px-4 py-2">Status</th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{r.order_id}</td>
                    <td className="px-4 py-2">{r.invoice?.student?.full_name ?? "-"}</td>
                    <td className="px-4 py-2">{r.invoice?.student?.parent?.full_name ?? "-"}</td>
                    <td className="px-4 py-2">{r.invoice?.name}</td>
                    <td className="px-4 py-2">{r.payment_type ?? "-"}</td>
                    <td className="px-4 py-2">{formatDateTime(r.paid_at ?? r.created_at)}</td>
                    <td className="px-4 py-2 text-right">{formatRupiah(r.amount)}</td>
                    <td className="px-4 py-2 text-xs">{PAYMENT_STATUS_LABEL[r.transaction_status]}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Belum ada pembayaran.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
