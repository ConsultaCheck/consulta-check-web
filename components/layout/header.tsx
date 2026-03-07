"use client";

import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { clearStoredToken } from "@/lib/api";

/**
 * Header global: nombre del sistema, avatar de usuario y logout.
 */
export function Header() {
  const router = useRouter();

  const handleLogout = () => {
    clearStoredToken();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end border-b border-border bg-card pl-14 pr-4 shadow-sm lg:pl-4">
      <div className="flex items-center gap-2">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </header>
  );
}
