import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatRupiah, formatDate, INVOICE_STATUS_LABEL } from "@/lib/format";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tagihan/")({
  component: InvoicesPage,
});

function InvoicesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid" | "overdue">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("invoices")
        .select("id, invoice_number, name, amount, paid_amount, status, due_date, student:students(full_name)")
        .order("due_date", { ascending: true });
      setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return rows.filter((r) => {
      if (filter === "all") return true;
      if (filter === "paid") return r.status === "paid";
      if (filter === "unpaid") return r.status !== "paid";
      if (filter === "overdue") return r.status !== "paid" && new Date(r.due_date) < today;
      return true;
    });
  }, [rows, filter]);

  return (
    <>
      <PageHeader title="Tagihan Saya" description="Daftar tagihan untuk ananda" />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="unpaid">Belum Dibayar</TabsTrigger>
          <TabsTrigger value="paid">Lunas</TabsTrigger>
          <TabsTrigger value="overdue">Jatuh Tempo</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-3 mt-4">
        {loading && <p className="text-muted-foreground">Memuat…</p>}
        {!loading && filtered.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground"><FileText className="size-8 mx-auto mb-2 opacity-50" />Tidak ada tagihan.</CardContent></Card>
        )}
        {filtered.map((i) => {
          const sisa = Number(i.amount) - Number(i.paid_amount || 0);
          const isPaid = i.status === "paid";
          return (
            <Card key={i.id}>
              <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-muted-foreground">{i.invoice_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isPaid ? "bg-[color:var(--success)]/15 text-[color:var(--success)]" : "bg-warning/20 text-warning-foreground"}`}>
                      {INVOICE_STATUS_LABEL[i.status]}
                    </span>
                  </div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-sm text-muted-foreground">{i.student?.full_name} · Jatuh tempo {formatDate(i.due_date)}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{formatRupiah(i.amount)}</div>
                  {!isPaid && Number(i.paid_amount) > 0 && <div className="text-xs text-muted-foreground">Sisa {formatRupiah(sisa)}</div>}
                </div>
                <Link 
                  to="/tagihan/$id" 
                  params={{ id: i.id }}
                  className={buttonVariants({ variant: isPaid ? "outline" : "default" })}
                >
                  {isPaid ? "Lihat Nota" : "Bayar Sekarang"}
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
