"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  FileText,
  GitCompare,
  Calculator,
  Menu,
  X,
  LogOut,
  User,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { clearStoredToken, apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/attendances", label: "Asistencias", icon: CalendarCheck },
  { href: "/liquidations", label: "Cargas", icon: FileText },
  { href: "/reconciliation", label: "Reconciliación", icon: GitCompare },
  { href: "/rentabilidad", label: "Rentabilidad", icon: Calculator },
];

/**
 * Sidebar de navegación principal. Colapsa en pantallas pequeñas (tablet/mobile).
 * Incluye el logo de ConsultaCheck, navegación y acciones de usuario (avatar + logout).
 */
type MeUser = { id: string; email: string; name?: string; role: string };

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<MeUser | null>(null);

  useEffect(() => {
    apiFetch<MeUser>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const handleLogout = () => {
    clearStoredToken();
    router.push("/");
  };

  return (
    <>
      {/* Header móvil/tablet: evita solapamiento del icono */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <Link
          href="/dashboard"
          className="min-w-0 truncate font-semibold text-primary"
          onClick={() => setOpen(false)}
        >
          ConsultaCheck
        </Link>
      </header>

      {/* Overlay en móvil cuando está abierto */}
      {open && (
        <div
          className="fixed inset-0 top-14 z-40 bg-black/50 lg:top-0 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-14 z-40 h-[calc(100dvh-3.5rem)] w-64 border-r border-border bg-card shadow-sm transition-transform duration-200 lg:top-0 lg:h-full lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo solo en desktop; en móvil está en el header superior */}
          <div className="hidden h-16 items-center justify-center border-b border-border px-4 lg:flex">
            <Link
              href="/dashboard"
              className="font-semibold text-primary"
              onClick={() => setOpen(false)}
            >
              ConsultaCheck
            </Link>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto p-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">
                    {user?.name || user?.email || "Usuario"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate" title={user?.email}>
                    {user?.email || "-"}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground"
                onClick={handleLogout}
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
