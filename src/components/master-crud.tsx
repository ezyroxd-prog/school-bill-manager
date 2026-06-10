import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "checkbox" | "textarea";
  required?: boolean;
  placeholder?: string;
}

export interface ColumnDef<T> {
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface Props<T extends { id: string }> {
  table: string;
  title: string;
  fields: FieldDef[];
  columns: ColumnDef<T>[];
  selectColumns?: string;
  defaultValues?: Record<string, any>;
  orderBy?: { column: string; ascending?: boolean };
}

export function MasterCrud<T extends { id: string }>({ table, title, fields, columns, selectColumns = "*", defaultValues = {}, orderBy }: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);

  async function load() {
    setLoading(true);
    let q = supabase.from(table).select(selectColumns);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as unknown as T[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [table]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = { ...defaultValues };
    for (const f of fields) {
      if (f.type === "checkbox") payload[f.name] = fd.get(f.name) === "on";
      else if (f.type === "number") payload[f.name] = Number(fd.get(f.name) || 0);
      else payload[f.name] = (fd.get(f.name) as string)?.trim() || null;
    }
    const op = editing
      ? supabase.from(table).update(payload).eq("id", editing.id)
      : supabase.from(table).insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(editing ? "Berhasil diperbarui" : "Berhasil ditambahkan");
    setOpen(false); setEditing(null);
    load();
  }

  async function handleDelete(row: T) {
    if (!confirm("Hapus data ini?")) return;
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Berhasil dihapus");
    load();
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="size-4 mr-2" /> Tambah</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? `Edit ${title}` : `Tambah ${title}`}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              {fields.map((f) => {
                const v = editing ? (editing as any)[f.name] : "";
                if (f.type === "checkbox") {
                  return (
                    <label key={f.name} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={f.name} defaultChecked={!!v} className="size-4" />
                      {f.label}
                    </label>
                  );
                }
                if (f.type === "textarea") {
                  return (
                    <div key={f.name} className="space-y-1.5">
                      <Label htmlFor={f.name}>{f.label}</Label>
                      <textarea id={f.name} name={f.name} required={f.required} defaultValue={v ?? ""} className="w-full rounded-md border px-3 py-2 text-sm bg-background" rows={3} />
                    </div>
                  );
                }
                return (
                  <div key={f.name} className="space-y-1.5">
                    <Label htmlFor={f.name}>{f.label}</Label>
                    <Input id={f.name} name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} defaultValue={v ?? ""} />
                  </div>
                );
              })}
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
                <tr>
                  {columns.map((c, i) => <th key={i} className={`px-4 py-2 font-medium ${c.className ?? ""}`}>{c.label}</th>)}
                  <th className="px-4 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={columns.length + 1} className="px-4 py-6 text-center text-muted-foreground">Memuat…</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={columns.length + 1} className="px-4 py-6 text-center text-muted-foreground">Belum ada data.</td></tr>}
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    {columns.map((c, i) => <td key={i} className={`px-4 py-2 ${c.className ?? ""}`}>{c.render(row)}</td>)}
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(row); setOpen(true); }}><Pencil className="size-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(row)}><Trash2 className="size-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
