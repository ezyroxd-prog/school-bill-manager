import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRupiah, formatDate, INVOICE_STATUS_LABEL } from "@/lib/format";
import { GraduationCap, Users, FileText, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function StatCard({ icon: Icon, label, value, hint, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div className={`rounded-lg p-2 ${accent ?? "bg-secondary text-secondary-foreground"}`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { role, fullName } = useAuth();
  if (role === "admin") return <AdminDashboard />;
  return <ParentDashboard name={fullName} />;
}

function AdminDashboard() {
  const [stats, setStats] = useState({
    students: 0, parents: 0, activeInvoices: 0, paid: 0, unpaid: 0,
    revenueMonth: 0, revenueYear: 0, recentPayments: [] as any[], recentInvoices: [] as any[],
    monthlyChart: [] as { month: string; total: number }[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      const [students, parents, invAll, invPaid, invUnpaid, payMonth, payYear, recentPays, recentInvs, payYearAll] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "parent"),
        supabase.from("invoices").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "paid"),
        supabase.from("invoices").select("id", { count: "exact", head: true }).neq("status", "paid"),
        supabase.from("payments").select("amount").in("transaction_status", ["settlement", "capture"]).gte("paid_at", monthStart),
        supabase.from("payments").select("amount").in("transaction_status", ["settlement", "capture"]).gte("paid_at", yearStart),
        supabase.from("payments").select("id, amount, paid_at, transaction_status, invoice:invoices(invoice_number, name, student:students(full_name))").order("created_at", { ascending: false }).limit(5),
        supabase.from("invoices").select("id, invoice_number, name, amount, status, due_date, student:students(full_name)").order("created_at", { ascending: false }).limit(5),
        supabase.from("payments").select("amount, paid_at").in("transaction_status", ["settlement", "capture"]).gte("paid_at", yearStart),
      ]);

      const sum = (rows: { amount: number | string }[] | null) => (rows ?? []).reduce((a, r) => a + Number(r.amount || 0), 0);

      const chartMap = new Map<number, number>();
      (payYearAll.data ?? []).forEach((p: any) => {
        if (!p.paid_at) return;
        const m = new Date(p.paid_at).getMonth();
        chartMap.set(m, (chartMap.get(m) ?? 0) + Number(p.amount || 0));
      });
      const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
      const monthlyChart = months.map((m, i) => ({ month: m, total: chartMap.get(i) ?? 0 }));

      setStats({
        students: students.count ?? 0,
        parents: parents.count ?? 0,
        activeInvoices: invAll.count ?? 0,
        paid: invPaid.count ?? 0,
        unpaid: invUnpaid.count ?? 0,
        revenueMonth: sum(payMonth.data as any),
        revenueYear: sum(payYear.data as any),
        recentPayments: recentPays.data ?? [],
        recentInvoices: recentInvs.data ?? [],
        monthlyChart,
      });
      setLoading(false);
    })();
  }, []);

  const totalInv = stats.paid + stats.unpaid;
  const paidPct = totalInv > 0 ? Math.round((stats.paid / totalInv) * 100) : 0;

  return (
    <>
      <PageHeader title="Dashboard Admin" description="Ringkasan keuangan dan aktivitas sekolah" />
      {loading ? (
        <div className="text-muted-foreground">Memuat statistik…</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <StatCard icon={GraduationCap} label="Total Siswa" value={String(stats.students)} accent="bg-primary/10 text-primary" />
            <StatCard icon={Users} label="Total Orang Tua" value={String(stats.parents)} accent="bg-accent/30 text-accent-foreground" />
            <StatCard icon={FileText} label="Total Tagihan" value={String(stats.activeInvoices)} accent="bg-secondary text-secondary-foreground" />
            <StatCard icon={TrendingUp} label="Persentase Lunas" value={`${paidPct}%`} hint={`${stats.paid} dari ${totalInv} tagihan`} accent="bg-primary/10 text-primary" />
            <StatCard icon={CheckCircle2} label="Lunas" value={String(stats.paid)} accent="bg-[color:var(--success)]/15 text-[color:var(--success)]" />
            <StatCard icon={AlertCircle} label="Belum Lunas" value={String(stats.unpaid)} accent="bg-destructive/10 text-destructive" />
            <StatCard icon={TrendingUp} label="Pendapatan Bulan Ini" value={formatRupiah(stats.revenueMonth)} />
            <StatCard icon={TrendingUp} label="Pendapatan Tahun Ini" value={formatRupiah(stats.revenueYear)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3 mt-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Pemasukan per Bulan ({new Date().getFullYear()})</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={stats.monthlyChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(v) => v >= 1_000_000 ? `${v/1_000_000}jt` : `${v/1000}rb`} />
                      <Tooltip formatter={(v: number) => formatRupiah(v)} />
                      <Bar dataKey="total" fill="oklch(0.55 0.15 150)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Pembayaran Terbaru</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {stats.recentPayments.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>}
                {stats.recentPayments.map((p: any) => (
                  <div key={p.id} className="flex justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <div className="font-medium">{p.invoice?.student?.full_name ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">{p.invoice?.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatRupiah(p.amount)}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(p.paid_at)}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader><CardTitle className="text-base">Tagihan Terbaru</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr><th className="py-2">No. Tagihan</th><th>Siswa</th><th>Jenis</th><th>Jatuh Tempo</th><th className="text-right">Nominal</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {stats.recentInvoices.map((i: any) => (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{i.invoice_number}</td>
                        <td>{i.student?.full_name ?? "-"}</td>
                        <td>{i.name}</td>
                        <td>{formatDate(i.due_date)}</td>
                        <td className="text-right">{formatRupiah(i.amount)}</td>
                        <td><span className="text-xs">{INVOICE_STATUS_LABEL[i.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function ParentDashboard({ name }: { name: string }) {
  const [data, setData] = useState({ total: 0, paid: 0, unpaid: 0, tunggakan: 0, invoices: [] as any[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: invs } = await supabase.from("invoices")
        .select("id, invoice_number, name, amount, paid_amount, status, due_date, student:students(full_name)")
        .order("due_date", { ascending: true });
      const list = invs ?? [];
      const paid = list.filter((i: any) => i.status === "paid").length;
      const unpaid = list.length - paid;
      const tunggakan = list.filter((i: any) => i.status !== "paid").reduce((a: number, i: any) => a + Number(i.amount) - Number(i.paid_amount || 0), 0);
      setData({ total: list.length, paid, unpaid, tunggakan, invoices: list.slice(0, 5) });
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <PageHeader title={`Selamat datang, ${name || "Wali Murid"}`} description="Ringkasan tagihan dan pembayaran ananda" />
      {loading ? <div className="text-muted-foreground">Memuat…</div> : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={FileText} label="Total Tagihan" value={String(data.total)} />
            <StatCard icon={CheckCircle2} label="Lunas" value={String(data.paid)} accent="bg-[color:var(--success)]/15 text-[color:var(--success)]" />
            <StatCard icon={AlertCircle} label="Belum Lunas" value={String(data.unpaid)} accent="bg-destructive/10 text-destructive" />
            <StatCard icon={TrendingUp} label="Total Tunggakan" value={formatRupiah(data.tunggakan)} accent="bg-warning/20 text-warning-foreground" />
          </div>

          <Card className="mt-6">
            <CardHeader><CardTitle className="text-base">Tagihan Terbaru</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr><th className="py-2">No. Tagihan</th><th>Siswa</th><th>Nama</th><th>Jatuh Tempo</th><th className="text-right">Nominal</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {data.invoices.map((i: any) => (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs">{i.invoice_number}</td>
                        <td>{i.student?.full_name ?? "-"}</td>
                        <td>{i.name}</td>
                        <td>{formatDate(i.due_date)}</td>
                        <td className="text-right">{formatRupiah(i.amount)}</td>
                        <td><span className="text-xs">{INVOICE_STATUS_LABEL[i.status]}</span></td>
                      </tr>
                    ))}
                    {data.invoices.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Belum ada tagihan.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
