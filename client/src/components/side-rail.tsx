import { Link, useLocation } from "wouter";
import { LogOut, Skull } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useManagementNav } from "@/lib/management-nav";

export function SideRail() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const modules = useManagementNav();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col overflow-y-auto border-r border-border bg-card md:flex xl:w-56">
      <Link href="/overview" aria-label="Accueil" aria-current={location === "/overview" ? "page" : undefined}
        className="flex min-h-20 shrink-0 items-center justify-center gap-2 border-b border-border px-3 text-primary hover:bg-muted/50 xl:justify-start">
        <span className="workspace-icon size-10" data-tone="red"><Skull className="size-5" aria-hidden /></span>
        <span className="hidden font-display font-bold xl:inline">Zomb’in The Dark</span>
      </Link>
      <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-1 px-2 py-4 xl:px-3">
        {modules.map(({ icon: Icon, label, path, tone }) => (
          <Link href={path} key={path} aria-current={location === path ? "page" : undefined} title={label}
            className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary xl:flex-row xl:justify-start xl:gap-2 xl:px-3">
            <span className="workspace-icon size-8" data-tone={tone}><Icon className="size-4" aria-hidden /></span>
            <span className="text-center text-[10px] font-medium leading-tight xl:text-left xl:text-sm">{path === "/admin" ? <><span className="xl:hidden">Admin</span><span className="hidden xl:inline">{label}</span></> : label}</span>
          </Link>
        ))}
      </nav>
      <div className="border-t border-border p-2">
        {user && <p className="truncate px-2 py-1 text-center text-xs text-muted-foreground xl:text-left">{user.username}</p>}
        <button onClick={logout} className="flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground xl:flex-row xl:justify-start xl:gap-2 xl:px-3">
          <LogOut className="size-4" aria-hidden /> Quitter
        </button>
      </div>
    </aside>
  );
}
