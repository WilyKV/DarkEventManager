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
  const shortcuts = [homeItem, ...(primary ? [primary] : []), ...(scanner ? [scanner] : []), ...(admin ? [admin] : [])];

  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex h-16 items-stretch px-2">
        {shortcuts.map(({ icon: Icon, label, path }) => path === "/scan" && onWelcome ? (
          <button key={path} type="button" onClick={onWelcome}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold text-emerald-300 hover:bg-primary/10">
            <UserCheck className="size-5" aria-hidden /> Accueillir
          </button>
        ) : (
          <Link key={path} href={path} aria-current={location === path ? "page" : undefined}
            aria-label={path === "/admin" ? label : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-muted-foreground hover:text-foreground aria-[current=page]:text-primary">
            <Icon className="size-5" aria-hidden />{path === "/admin" ? "Admin" : path === "/scan" ? "Scanner" : label}
          </Link>
        ))}
        {onPhotos && <button type="button" onClick={onPhotos}
          className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold text-primary hover:bg-primary/10">
          <Camera className="size-5" aria-hidden /> Photos
        </button>}
        <Sheet>
          <SheetTrigger className={cn("flex flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-muted-foreground hover:text-foreground",
            modules.some(item => item.path === location) && !shortcuts.some(item => item.path === location) && "text-primary")}>
            <Menu className="size-5" aria-hidden /> Menu
          </SheetTrigger>
          <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-xl overflow-y-auto rounded-t-2xl px-4 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <SheetTitle>Tous les menus</SheetTitle>
            <SheetDescription className="sr-only">Sections disponibles avec votre compte.</SheetDescription>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[homeItem, ...modules].map(({ icon: Icon, label, path }) => (
                <SheetClose asChild key={path}>
                  <Link href={path} aria-current={location === path ? "page" : undefined}
                    className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:border-primary/40 aria-[current=page]:border-primary/60 aria-[current=page]:text-primary">
                    <Icon className="size-4 shrink-0" aria-hidden />
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
