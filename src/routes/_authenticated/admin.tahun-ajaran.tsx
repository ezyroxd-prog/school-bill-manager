import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { MasterCrud } from "@/components/master-crud";

export const Route = createFileRoute("/_authenticated/admin/tahun-ajaran")({
  component: () => (
    <>
      <PageHeader title="Tahun Ajaran" description="Kelola tahun ajaran sekolah" />
      <MasterCrud
        table="academic_years"
        title="Tahun Ajaran"
        orderBy={{ column: "name", ascending: false }}
        fields={[
          { name: "name", label: "Nama", required: true, placeholder: "2025/2026" },
          { name: "is_active", label: "Aktif", type: "checkbox" },
        ]}
        columns={[
          { label: "Nama", render: (r: any) => r.name },
          { label: "Status", render: (r: any) => r.is_active ? <span className="text-[color:var(--success)] font-medium">Aktif</span> : <span className="text-muted-foreground">Nonaktif</span> },
        ]}
      />
    </>
  ),
});
