import { Link, useLocation } from "wouter";
import { Camera, LogOut, Menu, UserCheck } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { homeItem, useManagementNav } from "@/lib/management-nav";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { InstallAppButton } from "./install-prompt";

export function BottomNav({ onWelcome, onPhotos }: { onWelcome?: () => void; onPhotos?: () => void }) {
  const [location] = useLocation();
  const modules = useManagementNav();
  const { logout } = useAuth();
  const scanner = modules.find(item => item.path === "/scan");
  const admin = modules.find(item => item.path === "/admin");
  const primary = modules.find(item => ["/zombie", "/survivant", "/boutique", "/repas"].includes(item.path));
  const shortcuts = [homeItem, ...(primary ? [primary] : []), ...(scanner ? [scanner] : [])];

  return (
    <nav aria-label="Navigation mobile" className="workspace-navigation fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex h-16 items-stretch px-2">
        {shortcuts.map(({ icon: Icon, label, path }) => path === "/scan" && onWelcome ? (
          <button key={path} type="button" onClick={onWelcome}
            className="mobile-shortcut font-semibold text-primary">
            <UserCheck className="size-5" aria-hidden /> Accueillir
          </button>
        ) : (
          <Link key={path} href={path} aria-current={location === path ? "page" : undefined}
            className="mobile-shortcut text-muted-foreground">
            <Icon className="size-5" aria-hidden />{path === "/scan" ? "Scanner" : label}
          </Link>
        ))}
        {onPhotos && (
          <button type="button" onClick={onPhotos} className="mobile-shortcut text-primary">
            <Camera className="size-5" aria-hidden /> Photos
          </button>
        )}
        {admin && (
          <Link href={admin.path} aria-label={admin.label} aria-current={location === admin.path ? "page" : undefined} className="mobile-shortcut text-muted-foreground">
            <admin.icon className="size-5" aria-hidden /> Admin
          </Link>
        )}
        <Sheet>
          <SheetTrigger className={cn("mobile-shortcut text-muted-foreground",
            modules.some(item => item.path === location) && location !== admin?.path && !shortcuts.some(item => item.path === location) && "text-primary")}>
            <Menu className="size-5" aria-hidden /> Menu
          </SheetTrigger>
          <SheetContent side="bottom" className="workspace-navigation mx-auto max-h-[85dvh] max-w-xl overflow-y-auto rounded-t-2xl px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <SheetTitle>Tous les menus</SheetTitle>
            <SheetDescription className="sr-only">Sections disponibles avec votre compte.</SheetDescription>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[homeItem, ...modules].map(({ icon: Icon, label, path, tone }) => (
                <SheetClose asChild key={path}>
                  <Link href={path} aria-current={location === path ? "page" : undefined}
                    className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:border-primary/40 aria-[current=page]:border-primary/60 aria-[current=page]:text-primary">
                    <span className="workspace-icon size-8" data-tone={tone}><Icon className="size-4" aria-hidden /></span>
                    <span className="flex-1 break-words">{label}</span>
                  </Link>
                </SheetClose>
              ))}
              <SheetClose asChild>
                <button type="button" onClick={() => void logout()} className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground">
                  <LogOut className="size-4 shrink-0" aria-hidden /> Se déconnecter
                </button>
              </SheetClose>
            </div>
            <InstallAppButton className="mt-4 w-full" />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
