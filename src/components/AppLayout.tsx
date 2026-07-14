import { NavLink, useLocation } from "react-router-dom";
import { CalendarDays, Settings, BarChart3, LogOut, Clock, ListTodo, PanelLeft, Lightbulb, CalendarRange, RefreshCw, Activity, TrendingUp, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTabVisible, type TabKey } from "@/lib/ui-prefs";

type NavItem = { to: string; label: string; icon: typeof CalendarDays; tab?: TabKey };
const baseNavItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tab: "dashboard" },
  { to: "/", label: "Daily", icon: CalendarDays, tab: "daily" },
  { to: "/routine", label: "Routine", icon: Clock, tab: "routine" },
  { to: "/test", label: "Habits", icon: RefreshCw, tab: "habits" },
  { to: "/health", label: "Health", icon: Activity, tab: "health" },
  { to: "/correlation", label: "Correlation", icon: TrendingUp, tab: "correlation" },
  { to: "/todo", label: "Projet", icon: ListTodo, tab: "todo" },
  { to: "/inspiration", label: "To Do", icon: Lightbulb, tab: "plan" },
  { to: "/calendar", label: "Calendrier", icon: CalendarRange, tab: "calendar" },
  { to: "/statistics", label: "Statistiques", icon: BarChart3, tab: "statistics" },
  { to: "/settings", label: "Réglages", icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

function NavItemLink({ item, collapsed, isActive }: { item: NavItem; collapsed: boolean; isActive: boolean }) {
  const [visible] = useTabVisible((item.tab ?? "daily") as TabKey);
  if (item.tab && !visible) return null;
  return (
    <NavLink
      to={item.to}
      className={cn(
        "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50",
        collapsed && "justify-center px-0"
      )}
      title={collapsed ? item.label : undefined}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

export default function AppLayout({ children, onLogout }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside
        className={cn(
          "sticky top-0 h-screen border-r border-sidebar-border bg-sidebar flex flex-col transition-all duration-200 z-50 shrink-0",
          collapsed ? "w-14" : "w-48"
        )}
      >
        <div className={cn("flex items-center h-14 px-3 border-b border-sidebar-border", collapsed ? "justify-center" : "gap-2")}>
          {!collapsed && <span className="text-lg font-bold text-sidebar-primary tracking-tight">Tracker</span>}
          <Button
            variant="ghost" size="sm"
            className={cn("h-8 w-8 p-0 text-sidebar-foreground", collapsed && "mx-auto")}
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 py-2 px-2 overflow-y-auto">
          {baseNavItems.map((item) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return <NavItemLink key={item.to} item={item} collapsed={collapsed} isActive={isActive} />;
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost" size="sm"
            onClick={handleLogout}
            className={cn(
              "w-full gap-2 text-sidebar-foreground hover:bg-sidebar-accent/50",
              collapsed && "px-0 justify-center"
            )}
            title={collapsed ? "Déconnexion" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-auto">{children}</main>
    </div>
  );
}
