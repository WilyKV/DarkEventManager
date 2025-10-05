import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "./notification-center";

interface ManagementLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function ManagementLayout({ title, subtitle, children, actions }: ManagementLayoutProps) {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-display text-primary">{title}</h1>
              <p className="text-muted-foreground mt-1">{subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationCenter />
            {actions}
          </div>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}
