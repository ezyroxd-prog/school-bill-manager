import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { MasterCrud } from "@/components/master-crud";

export const Route = createFileRoute("/_authenticated/admin/kelas")({
  component: () => (
    <>
      <PageHeader title="Data Kelas" description="Kelola daftar kelas dan wali kelas" />
      <MasterCrud
        table="classes"
        title="Kelas"
        orderBy={{ column: "name" }}
        fields={[
          { name: "name", label: "Nama Kelas", required: true, placeholder: "Contoh: Kelas 3A" },
          { name: "homeroom_teacher", label: "Wali Kelas" },
        ]}
        columns={[
          { label: "Nama Kelas", render: (r: any) => r.name },
          { label: "Wali Kelas", render: (r: any) => r.homeroom_teacher ?? "-" },
        ]}
      />
    </>
  ),
});
