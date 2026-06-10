import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Search, Copy } from "lucide-react";
import { toast } from "sonner";
import { formatRupiah, formatDate, INVOICE_STATUS_LABEL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/tagihan")({
  component: InvoicesAdmin,
});

function InvoicesAdmin() {
  const [rows, setRows] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "class" | "all">("single");
  const [form, setForm] = useState<any>({ amount: 0 });

  async function load() {
    const [{ data: i }, { data: s }, { data: c }, { data: t }] = await Promise.all([
      supabase.from("invoices").select("*, student:students(full_name, class:classes(name)), billing_type:billing_types(name)").order("created_at", { ascending: false }),
      supabase.from("students").select("id, full_name, class_id").order("full_name"),
      supabase.from("classes").select("id, name").order("name"),
      supabase.from("billing_types").select("id, name, default_amount").order("name"),
    ]);
    setRows(i ?? []); setStudents(s ?? []); setClasses(c ?? []); setTypes(t ?? []);
  }
  useEffect(() => { load(); }, []);

  async function createInvoices(e: React.FormEvent) {
    e.preventDefault();
    const base = {
      name: form.name,
      billing_type_id: form.billing_type_id || null,
      amount: Number(form.amount),
      due_date: form.due_date,
      description: form.description || null,
    };

    let targets: string[] = [];
    if (mode === "single") targets = form.student_id ? [form.student_id] : [];
    else if (mode === "class") targets = students.filter((s) => s.class_id === form.class_id).map((s) => s.id);
    else targets = students.map((s) => s.id);

    if (targets.length === 0) return toast.error("Tidak ada siswa terpilih");

    const payload = targets.map((sid) => {
      const s = students.find((x) => x.id === sid);
      return { ...base, student_id: sid, class_id: s?.class_id ?? null };
    });
    const { error } = await supabase.from("invoices").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(`${payload.length} tagihan dibuat`);
    setOpen(false); setForm({ amount: 0 }); load();
  }

  async function remove(id: string) {
    if (!confirm("Hapus tagihan ini?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus"); load();
  }

  async function duplicate(row: any) {
    const { id, invoice_number, created_at, updated_at, paid_amount, status, ...rest } = row;
    delete rest.student; delete rest.billing_type;
    const { error } = await supabase.from("invoices").insert({ ...rest, paid_amount: 0, status: "unpaid" });
    if (error) return toast.error(error.message);
    toast.success("Tagihan diduplikasi"); load();
  }

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    const q = search.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.invoice_number.toLowerCase().includes(q) || r.student?.full_name?.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader title="Manajemen Tagihan" description="Buat, edit, dan kelola tagihan siswa" />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari nomor, nama, atau siswa…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="unpaid">Belum Dibayar</SelectItem>
            <SelectItem value="partial">Sebagian Dibayar</SelectItem>
            <SelectItem value="paid">Lunas</SelectItem>
            <SelectItem value="expired">Kadaluarsa</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4 mr-2" /> Buat Tagihan</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Buat Tagihan</DialogTitle></DialogHeader>
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList className="grid grid-cols-3">
                <TabsTrigger value="single">Per Siswa</TabsTrigger>
                <TabsTrigger value="class">Per Kelas</TabsTrigger>
                <TabsTrigger value="all">Semua</TabsTrigger>
              </TabsList>
              <form onSubmit={createInvoices} className="space-y-3 pt-4">
                <TabsContent value="single" className="m-0">
                  <Label>Siswa</Label>
                  <Select value={form.student_id ?? ""} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih siswa" /></SelectTrigger>
                    <SelectContent>{students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </TabsContent>
                <TabsContent value="class" className="m-0">
                  <Label>Kelas</Label>
                  <Select value={form.class_id ?? ""} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                    <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </TabsContent>
                <TabsContent value="all" className="m-0">
                  <p className="text-sm text-muted-foreground">Tagihan akan dibuat untuk seluruh {students.length} siswa.</p>
                </TabsContent>

                <div className="space-y-1.5">
                  <Label>Jenis Tagihan</Label>
                  <Select value={form.billing_type_id ?? ""} onValueChange={(v) => {
                    const t = types.find((x) => x.id === v);
                    setForm({ ...form, billing_type_id: v, name: t?.name ?? form.name, amount: t?.default_amount ?? form.amount });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                    <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Nama Tagihan</Label><Input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: SPP Januari 2026" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Nominal</Label><Input type="number" required value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Jatuh Tempo</Label><Input type="date" required value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                </div>
                <div className="space-y-1.5"><Label>Keterangan</Label><textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-md border px-3 py-2 text-sm bg-background" rows={2} /></div>
                <DialogFooter><Button type="submit">Buat</Button></DialogFooter>
              </form>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="px-4 py-2">No</th><th className="px-4 py-2">Nama</th><th className="px-4 py-2">Siswa</th><th className="px-4 py-2">Kelas</th><th className="px-4 py-2">Jatuh Tempo</th><th className="px-4 py-2 text-right">Nominal</th><th className="px-4 py-2">Status</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{r.invoice_number}</td>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2">{r.student?.full_name ?? "-"}</td>
                    <td className="px-4 py-2">{r.student?.class?.name ?? "-"}</td>
                    <td className="px-4 py-2">{formatDate(r.due_date)}</td>
                    <td className="px-4 py-2 text-right">{formatRupiah(r.amount)}</td>
                    <td className="px-4 py-2 text-xs">{INVOICE_STATUS_LABEL[r.status]}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => duplicate(r)} title="Duplikasi"><Copy className="size-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Belum ada tagihan.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
