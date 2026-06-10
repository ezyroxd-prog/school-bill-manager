import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { CheckCircle2, XCircle } from "lucide-react";
import logo from "@/assets/school-logo.png";

export const Route = createFileRoute("/verify/$code")({
  ssr: false,
  head: () => ({ meta: [{ title: "Verifikasi Nota — SAAPayment" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { code } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: rec } = await supabase.from("receipts")
        .select("receipt_number, issued_at, verification_code")
        .eq("verification_code", code).maybeSingle();
      setData(rec); setLoading(false);
    })();
  }, [code]);

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="max-w-md w-full bg-card rounded-xl border p-8 text-center">
        <img src={logo} alt="" width={56} height={56} className="mx-auto mb-3" />
        <h1 className="font-bold text-lg">Verifikasi Nota</h1>
        <p className="text-xs text-muted-foreground mb-6 font-mono">{code}</p>
        {loading ? <p className="text-muted-foreground">Memeriksa…</p> : data ? (
          <div>
            <CheckCircle2 className="size-16 text-[color:var(--success)] mx-auto" />
            <p className="font-semibold mt-3">Nota Sah & Terverifikasi</p>
            <div className="mt-4 text-sm space-y-1 text-left bg-muted/30 rounded-md p-4">
              <div><span className="text-muted-foreground">No. Nota:</span> <span className="font-mono">{data.receipt_number}</span></div>
              <div><span className="text-muted-foreground">Diterbitkan:</span> {formatDateTime(data.issued_at)}</div>
            </div>
          </div>
        ) : (
          <div>
            <XCircle className="size-16 text-destructive mx-auto" />
            <p className="font-semibold mt-3">Nota Tidak Ditemukan</p>
            <p className="text-sm text-muted-foreground mt-1">Kode verifikasi tidak valid.</p>
          </div>
        )}
      </div>
    </div>
  );
}
