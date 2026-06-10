import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/aktivitas")({
  component: ActivityPage,
});

function ActivityPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <>
      <PageHeader title="Aktivitas Sistem" description="Audit log webhook & aksi penting" />
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr><th className="px-4 py-2">Waktu</th><th className="px-4 py-2">Aksi</th><th className="px-4 py-2">Entitas</th><th className="px-4 py-2">ID</th><th className="px-4 py-2">Aktor</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className="border-t"><td className="px-4 py-2">{formatDateTime(r.created_at)}</td><td className="px-4 py-2">{r.action}</td><td className="px-4 py-2">{r.entity ?? "-"}</td><td className="px-4 py-2 font-mono text-xs">{r.entity_id ?? "-"}</td><td className="px-4 py-2">{r.actor_email ?? "system"}</td></tr>
        ))}{rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Belum ada aktivitas.</td></tr>}</tbody>
      </table></div></CardContent></Card>
    </>
  );
}
