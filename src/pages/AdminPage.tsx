import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Check, RotateCcw, Plug } from "lucide-react";
import { updateCredentials, getCurrentUsername } from "@/lib/auth-store";
import { THEME_PALETTE, useTheme } from "@/lib/theme-store";
import { loadCaldavConfig, saveCaldavConfig, testCaldav } from "@/lib/caldav-store";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { themeId, setTheme, resetTheme } = useTheme();

  // CalDAV
  const [caldav, setCaldav] = useState({ url: "", username: "", calendarName: "", password: "", hasPassword: false });
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    getCurrentUsername().then(setNewUsername);
    loadCaldavConfig().then((c) => setCaldav({ ...c, password: "" }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      toast.error("Le mot de passe actuel est requis");
      return;
    }
    if (!newUsername.trim()) {
      toast.error("L'identifiant ne peut pas être vide");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    const passwordToSet = newPassword || currentPassword;
    const success = await updateCredentials(currentPassword, newUsername, passwordToSet);
    if (success) {
      toast.success("Identifiants mis à jour !");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      toast.error("Mot de passe actuel incorrect");
    }
  };

  const lightThemes = THEME_PALETTE.filter((p) => !p.isDark);
  const darkThemes = THEME_PALETTE.filter((p) => p.isDark);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Administration</h1>

      {/* Apparence */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Apparence</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { resetTheme(); toast.success("Thème réinitialisé"); }} className="gap-1.5 h-8">
              <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Couleurs claires</Label>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {lightThemes.map((p) => (
                <ThemeSwatch key={p.id} palette={p} active={themeId === p.id} onClick={() => { setTheme(p.id); toast.success(`Thème "${p.label}" appliqué`); }} />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">Couleurs sombres</Label>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {darkThemes.map((p) => (
                <ThemeSwatch key={p.id} palette={p} active={themeId === p.id} onClick={() => { setTheme(p.id); toast.success(`Thème "${p.label}" appliqué`); }} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Identifiants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Modifier les identifiants</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Mot de passe actuel *</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Nouvel identifiant</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label>Nouveau mot de passe (laisser vide pour ne pas changer)</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmer le nouveau mot de passe</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full">
              Mettre à jour
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ThemeSwatch({ palette, active, onClick }: { palette: typeof THEME_PALETTE[number]; active: boolean; onClick: () => void }) {
  const { h, s, l } = palette.bg;
  const bg = `hsl(${h}, ${s}%, ${l}%)`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={palette.label}
      className={cn(
        "group relative h-14 rounded-md border-2 transition-all hover:scale-105 hover:shadow-md flex flex-col items-center justify-end overflow-hidden",
        active ? "border-primary ring-2 ring-primary/30" : "border-border"
      )}
      style={{ background: bg }}
    >
      {active && (
        <span className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
          <Check className="h-3 w-3" />
        </span>
      )}
      <span className={cn(
        "text-[9px] font-medium px-1 py-0.5 w-full text-center truncate bg-background/80 backdrop-blur-sm",
        palette.isDark ? "text-foreground" : "text-foreground"
      )}>
        {palette.label}
      </span>
    </button>
  );
}
