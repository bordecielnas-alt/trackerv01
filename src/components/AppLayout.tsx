import { NavLink } from "react-router-dom";
import { CalendarDays, Settings, BarChart3, TableProperties, ShieldCheck, LogOut, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth-store";

const navItems = [
  { to: "/", label: "Tracking", icon: CalendarDays },
  { to: "/routine", label: "Routine", icon: Clock },
  { to: "/settings", label: "Réglages", icon: Settings },
  { to: "/statistics", label: "Statistiques", icon: BarChart3 },
  { to: "/edition", label: "Édition", icon: TableProperties },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
];

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

export default function AppLayout({ children, onLogout }: AppLayoutProps) {
  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container flex h-14 items-center gap-6">
          <span className="text-lg font-bold text-primary tracking-tight">Tracker</span>
          <nav className="flex gap-1 flex-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
