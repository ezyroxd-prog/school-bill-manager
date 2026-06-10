import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, Wallet, ShieldCheck, BarChart3 } from "lucide-react";
import logo from "@/assets/school-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SAAPayment — Sistem Pembayaran SPP Sekolah Alam Al-Karim" },
      { name: "description", content: "Platform digital pengelolaan dan pembayaran SPP Sekolah Alam Al-Karim. Mudah, aman, dan transparan." },
      { property: "og:title", content: "SAAPayment — Sistem Pembayaran SPP Sekolah Alam Al-Karim" },
      { property: "og:description", content: "Kelola dan bayar SPP secara digital melalui Midtrans." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Sekolah Alam Al-Karim" width={40} height={40} className="rounded-md" />
            <div>
              <div className="font-semibold leading-tight">SAAPayment</div>
              <div className="text-xs text-muted-foreground">Sekolah Alam Al-Karim</div>
            </div>
          </div>
          <Link to="/auth"><Button>Masuk</Button></Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <ShieldCheck className="size-3.5" /> Pembayaran aman via Midtrans
          </span>
          <h1 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight">
            Bayar SPP jadi lebih mudah, cepat, dan transparan.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Sistem terpadu untuk admin sekolah dan orang tua. Kelola tagihan, pantau pembayaran,
            dan terima nota digital secara otomatis.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth"><Button size="lg">Mulai Sekarang</Button></Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            { icon: Wallet, title: "Pembayaran Digital", desc: "VA, QRIS, e-wallet, kartu kredit — semua dalam satu klik." },
            { icon: GraduationCap, title: "Per Siswa", desc: "Satu akun orang tua untuk semua anak di sekolah." },
            { icon: BarChart3, title: "Laporan Real-Time", desc: "Pantau tagihan, pemasukan, dan tunggakan secara langsung." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-6">
              <f.icon className="size-8 text-primary" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} Sekolah Alam Al-Karim</span>
          <span>SAAPayment</span>
        </div>
      </footer>
    </div>
  );
}
