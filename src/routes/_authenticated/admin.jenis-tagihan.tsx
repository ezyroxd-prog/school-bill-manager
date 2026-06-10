import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { MasterCrud } from "@/components/master-crud";
import { formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/jenis-tagihan")({
  component: () => (
    <>
      <PageHeader title="Jenis Tagihan" description="Kelola kategori tagihan sekolah" />
      <MasterCrud
        table="billing_types"
        title="Jenis Tagihan"
        orderBy={{ column: "name" }}
        fields={[
          { name: "name", label: "Nama", required: true },
          { name: "default_amount", label: "Nominal Default", type: "number" },
          { name: "description", label: "Keterangan", type: "textarea" },
        ]}
        columns={[
          { label: "Nama", render: (r: any) => r.name },
          { label: "Nominal Default", render: (r: any) => formatRupiah(r.default_amount) },
          { label: "Keterangan", render: (r: any) => r.description ?? "-" },
        ]}
      />
    </>
  ),
});
