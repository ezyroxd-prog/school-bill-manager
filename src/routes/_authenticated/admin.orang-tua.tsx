import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/orang-tua")({
  component: ParentsPage,
});

function ParentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "parent");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) { setRows([]); return; }
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids).order("full_name");
      const { data: students } = await supabase.from("students").select("id, full_name, parent_id").in("parent_id", ids);
      const grouped = (profiles ?? []).map((p) => ({
        ...p,
        children: (students ?? []).filter((s: any) => s.parent_id === p.id),
      }));
      setRows(grouped);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return !q || r.full_name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader title="Data Orang Tua" description="Daftar akun orang tua / wali murid yang terdaftar" />
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Cari nama atau email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="px-4 py-2">Nama</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">No HP</th><th className="px-4 py-2">Anak</th></tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 font-medium">{r.full_name || "-"}</td>
                    <td className="px-4 py-2">{r.email}</td>
                    <td className="px-4 py-2">{r.phone ?? "-"}</td>
                    <td className="px-4 py-2">
                      {r.children.length === 0 ? <span className="text-muted-foreground">Belum ada anak tertaut</span>
                        : r.children.map((c: any) => c.full_name).join(", ")}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Belum ada orang tua terdaftar.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
