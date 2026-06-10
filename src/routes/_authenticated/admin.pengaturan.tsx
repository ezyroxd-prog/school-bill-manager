import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/pengaturan")({
  component: SettingsPage,
});

function SettingsPage() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const webhookUrl = `${origin}/api/public/midtrans-notification`;

  function copy(v: string) {
    navigator.clipboard.writeText(v);
    toast.success("Disalin");
  }

  return (
    <>
      <PageHeader title="Pengaturan Sistem" description="Konfigurasi pembayaran & integrasi Midtrans" />
      <div className="grid gap-4 max-w-3xl">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /> Integrasi Midtrans (Sandbox)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-secondary/50 p-3 text-sm">
              <p className="font-medium">Server Key & Client Key tersimpan aman sebagai secret.</p>
              <p className="text-muted-foreground mt-1">Server Key hanya diakses oleh server function dan webhook handler. Client Key dikirim ke browser hanya ketika dibutuhkan oleh Snap.</p>
            </div>

            <div>
              <label className="text-sm font-medium">Webhook / Notification URL</label>
              <p className="text-xs text-muted-foreground mb-2">Salin URL ini ke Midtrans Dashboard → Settings → Configuration → Payment Notification URL.</p>
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} className="font-mono text-xs" />
                <Button variant="outline" onClick={() => copy(webhookUrl)}><Copy className="size-4" /></Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Environment</label>
              <p className="text-sm text-muted-foreground">Sandbox (testing) — gunakan kartu uji Midtrans.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Identitas Sekolah</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm">Sekolah Alam Al-Karim — SAAPayment</p>
            <p className="text-xs text-muted-foreground mt-1">Logo dan identitas digunakan pada nota pembayaran.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Akses Admin</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Akun yang mendaftar via halaman publik diberi role <code className="bg-muted px-1 rounded">parent</code>. Untuk menambahkan administrator, tambahkan baris ke tabel <code className="bg-muted px-1 rounded">user_roles</code> dengan role <code className="bg-muted px-1 rounded">admin</code>.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
