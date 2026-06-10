import { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, GraduationCap, School, CalendarRange, Tag,
  Receipt, Wallet, BarChart3, Activity, Settings, LogOut, FileText,
} from "lucide-react";
import logo from "@/assets/school-logo.png";
import { toast } from "sonner";

interface NavItem { to: string; label: string; icon: React.ComponentType<{ className?: string }>; }

const ADMIN_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/siswa", label: "Data Siswa", icon: GraduationCap },
  { to: "/admin/orang-tua", label: "Orang Tua", icon: Users },
  { to: "/admin/kelas", label: "Kelas", icon: School },
  { to: "/admin/tahun-ajaran", label: "Tahun Ajaran", icon: CalendarRange },
  { to: "/admin/jenis-tagihan", label: "Jenis Tagihan", icon: Tag },
  { to: "/admin/tagihan", label: "Tagihan", icon: FileText },
  { to: "/admin/pembayaran", label: "Pembayaran", icon: Wallet },
  { to: "/admin/laporan", label: "Laporan", icon: BarChart3 },
  { to: "/admin/aktivitas", label: "Aktivitas", icon: Activity },
  { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
];

const PARENT_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tagihan", label: "Tagihan", icon: FileText },
  { to: "/nota", label: "Nota Pembayaran", icon: Receipt },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, fullName, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Memuat…</div>;
  }
  if (!user) {
    // gate handles redirect, this is fallback
    return null;
  }

  const items = role === "admin" ? ADMIN_NAV : PARENT_NAV;

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Berhasil keluar");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-3">
          <img src={logo} alt="" width={36} height={36} />
          <div className="leading-tight">
            <div className="font-semibold text-sm">SAAPayment</div>
            <div className="text-xs text-muted-foreground">Sekolah Alam Al-Karim</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map((it) => {
            const active = pathname === it.to || (it.to !== "/dashboard" && pathname.startsWith(it.to));
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <it.icon className="size-4" />
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-2 py-1 text-xs">
            <div className="font-medium truncate">{fullName || user.email}</div>
            <div className="text-muted-foreground capitalize">{role === "admin" ? "Administrator" : "Orang Tua"}</div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
            <LogOut className="size-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function RoleOnly({ role, current, children }: { role: AppRole; current: AppRole | null; children: ReactNode }) {
  if (current !== role) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h2 className="font-semibold">Akses Ditolak</h2>
        <p className="text-sm text-muted-foreground mt-1">Halaman ini hanya untuk {role === "admin" ? "Administrator" : "Orang Tua"}.</p>
      </div>
    );
  }
  return <>{children}</>;
}
