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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/siswa")({
  component: StudentsPage,
});

function StudentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  async function load() {
    const [{ data: s }, { data: c }, { data: y }, { data: p }] = await Promise.all([
      supabase.from("students").select("*, class:classes(name), academic_year:academic_years(name), parent:profiles(full_name, email)").order("full_name"),
      supabase.from("classes").select("id, name").order("name"),
      supabase.from("academic_years").select("id, name").order("name", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
    ]);
    setRows(s ?? []); setClasses(c ?? []); setYears(y ?? []); setParents(p ?? []);
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setEditing(null); setForm({}); setOpen(true); }
  function openEdit(row: any) {
    setEditing(row);
    setForm({ nis: row.nis, full_name: row.full_name, class_id: row.class_id ?? "", academic_year_id: row.academic_year_id ?? "", parent_id: row.parent_id ?? "", parent_whatsapp: row.parent_whatsapp ?? "" });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      nis: form.nis?.trim(),
      full_name: form.full_name?.trim(),
      class_id: form.class_id || null,
      academic_year_id: form.academic_year_id || null,
      parent_id: form.parent_id || null,
      parent_whatsapp: form.parent_whatsapp?.trim() || null,
    };
    const op = editing ? supabase.from("students").update(payload).eq("id", editing.id) : supabase.from("students").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success("Berhasil disimpan");
    setOpen(false); load();
  }

  async function remove(row: any) {
    if (!confirm(`Hapus siswa ${row.full_name}?`)) return;
    const { error } = await supabase.from("students").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus"); load();
  }

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.full_name?.toLowerCase().includes(q) || r.nis?.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader title="Data Siswa" description="Kelola data seluruh siswa" />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari nama atau NIS…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="size-4 mr-2" /> Tambah Siswa</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit Siswa" : "Tambah Siswa"}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>NIS</Label><Input required value={form.nis ?? ""} onChange={(e) => setForm({ ...form, nis: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Nama Lengkap</Label><Input required value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Kelas</Label>
                  <Select value={form.class_id ?? ""} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                    <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tahun Ajaran</Label>
                  <Select value={form.academic_year_id ?? ""} onValueChange={(v) => setForm({ ...form, academic_year_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih tahun" /></SelectTrigger>
                    <SelectContent>{years.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Orang Tua / Wali</Label>
                  <Select value={form.parent_id ?? ""} onValueChange={(v) => setForm({ ...form, parent_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih akun orang tua" /></SelectTrigger>
                    <SelectContent>{parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Orang tua harus mendaftar lewat halaman Daftar terlebih dahulu.</p>
                </div>
                <div className="space-y-1.5 col-span-2"><Label>Nomor WhatsApp</Label><Input value={form.parent_whatsapp ?? ""} onChange={(e) => setForm({ ...form, parent_whatsapp: e.target.value })} /></div>
              </div>
              <DialogFooter><Button type="submit">Simpan</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="px-4 py-2">NIS</th><th className="px-4 py-2">Nama</th><th className="px-4 py-2">Kelas</th><th className="px-4 py-2">Tahun</th><th className="px-4 py-2">Orang Tua</th><th className="px-4 py-2">WA</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{r.nis}</td>
                    <td className="px-4 py-2 font-medium">{r.full_name}</td>
                    <td className="px-4 py-2">{r.class?.name ?? "-"}</td>
                    <td className="px-4 py-2">{r.academic_year?.name ?? "-"}</td>
                    <td className="px-4 py-2">{r.parent?.full_name ?? r.parent?.email ?? <span className="text-muted-foreground">Belum tertaut</span>}</td>
                    <td className="px-4 py-2">{r.parent_whatsapp ?? "-"}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="size-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="size-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Belum ada siswa.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
