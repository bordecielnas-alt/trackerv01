import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, GripVertical, ArrowUp, ArrowDown, Check, RotateCcw, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  getSettingsAsync,
  saveSettingsAsync,
  type TrackingParameter,
  type TrackingSettings,
} from "@/lib/tracking-store";
import { updateCredentials, getCurrentUsername } from "@/lib/auth-store";
import { THEME_PALETTE, useTheme } from "@/lib/theme-store";
import { loadCaldavConfig, saveCaldavConfig, testCaldav } from "@/lib/caldav-store";
import { loadHealthConfig, saveHealthConfig } from "@/lib/health-store";
import { cn } from "@/lib/utils";

const emptyParam = (): TrackingParameter => ({
  id: crypto.randomUUID(),
  name: "",
  defaultValue: 5,
  min: 0,
  max: 10,
  step: 1,
  order: 0,
});

export default function SettingsPage() {
  const [settings, setSettings] = useState<TrackingSettings>({ parameters: [], scoreFormula: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editParam, setEditParam] = useState<TrackingParameter>(emptyParam());
  const [isEditing, setIsEditing] = useState(false);

  // Identifiants
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Apparence
  const { themeId, setTheme, resetTheme } = useTheme();

  // CalDAV
  const [caldav, setCaldav] = useState({ url: "", username: "", calendarName: "", password: "", hasPassword: false });
  const [testing, setTesting] = useState(false);

  // Google Health
  const [health, setHealth] = useState({ enabled: false, clientId: "", accessToken: "", refreshToken: "", hasToken: false });

  useEffect(() => {
    getSettingsAsync().then(setSettings);
    getCurrentUsername().then(setNewUsername);
    loadCaldavConfig().then((c) => setCaldav({ ...c, password: "" }));
    loadHealthConfig().then((c) => setHealth((h) => ({ ...h, enabled: c.enabled, clientId: c.clientId, hasToken: c.hasToken })));
  }, []);

  const handleSaveFormula = async () => {
    await saveSettingsAsync(settings);
    toast.success("Formule de score enregistrée");
  };

  const openAdd = () => {
    const p = emptyParam();
    p.order = settings.parameters.length;
    setEditParam(p);
    setIsEditing(false);
    setDialogOpen(true);
  };

  const openEdit = (p: TrackingParameter) => {
    setEditParam({ ...p });
    setIsEditing(true);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const updated = { ...settings, parameters: settings.parameters.filter((p) => p.id !== id) };
    setSettings(updated);
    await saveSettingsAsync(updated);
    toast.success("Paramètre supprimé");
  };

  const handleMoveParam = async (id: string, direction: "up" | "down") => {
    const sorted = [...settings.parameters].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((p) => p.id === id);
    if ((direction === "up" && idx <= 0) || (direction === "down" && idx >= sorted.length - 1)) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const tempOrder = sorted[idx].order;
    sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
    sorted[swapIdx] = { ...sorted[swapIdx], order: tempOrder };
    const updated = { ...settings, parameters: sorted };
    setSettings(updated);
    await saveSettingsAsync(updated);
  };

  const handleSaveParam = async () => {
    if (!editParam.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    let params: TrackingParameter[];
    if (isEditing) {
      params = settings.parameters.map((p) => (p.id === editParam.id ? editParam : p));
    } else {
      params = [...settings.parameters, editParam];
    }
    const updated = { ...settings, parameters: params };
    setSettings(updated);
    await saveSettingsAsync(updated);
    setDialogOpen(false);
    toast.success(isEditing ? "Paramètre modifié" : "Paramètre ajouté");
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
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
      <h1 className="text-2xl font-bold text-foreground">Réglages</h1>

      <Accordion type="multiple" defaultValue={[]} className="space-y-2">
        {/* Paramètres de tracking */}
        <AccordionItem value="tracking" className="border rounded-lg px-4 border-b">
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            Paramètres de tracking
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="flex justify-end">
              <Button onClick={openAdd} size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </div>
            {settings.parameters.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paramètre configuré.</p>
            ) : (
              <div className="space-y-2">
                {settings.parameters
                  .sort((a, b) => a.order - b.order)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-foreground">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Défaut: {p.defaultValue} · Min: {p.min} · Max: {p.max} · Pas: {p.step}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleMoveParam(p.id, "up")}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleMoveParam(p.id, "down")}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
              </div>
            )}

            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-medium">Formule de score</Label>
              <p className="text-xs text-muted-foreground">
                Utilisez les noms des paramètres dans la formule. Ex: (Sommeil + Énergie / 3) - 5
              </p>
              <Textarea
                value={settings.scoreFormula}
                onChange={(e) => setSettings((s) => ({ ...s, scoreFormula: e.target.value }))}
                placeholder="(Paramètre1 + Paramètre2) / 2"
                rows={2}
              />
              <Button onClick={handleSaveFormula} size="sm">
                Enregistrer la formule
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Apparence */}
        <AccordionItem value="appearance" className="border rounded-lg px-4 border-b">
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            Apparence
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { resetTheme(); toast.success("Thème réinitialisé"); }} className="gap-1.5 h-8">
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
              </Button>
            </div>
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
          </AccordionContent>
        </AccordionItem>

        {/* CalDAV */}
        <AccordionItem value="caldav" className="border rounded-lg px-4 border-b">
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            Calendrier (CalDAV)
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>URL du serveur CalDAV</Label>
              <Input value={caldav.url} onChange={(e) => setCaldav({ ...caldav, url: e.target.value })} placeholder="https://exemple.com/remote.php/dav/" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Identifiant</Label>
                <Input value={caldav.username} onChange={(e) => setCaldav({ ...caldav, username: e.target.value })} autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe {caldav.hasPassword && <span className="text-xs text-muted-foreground">(défini)</span>}</Label>
                <Input type="password" value={caldav.password} onChange={(e) => setCaldav({ ...caldav, password: e.target.value })} placeholder={caldav.hasPassword ? "••••••••" : ""} autoComplete="new-password" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nom du calendrier (filtre, optionnel)</Label>
              <Input value={caldav.calendarName} onChange={(e) => setCaldav({ ...caldav, calendarName: e.target.value })} placeholder="Personnel" />
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={async () => {
                await saveCaldavConfig({ url: caldav.url, username: caldav.username, calendarName: caldav.calendarName, password: caldav.password || undefined });
                const c = await loadCaldavConfig();
                setCaldav({ ...c, password: "" });
                toast.success("Configuration CalDAV enregistrée");
              }}>Enregistrer</Button>
              <Button type="button" variant="outline" disabled={testing} onClick={async () => {
                setTesting(true);
                const r = await testCaldav();
                setTesting(false);
                if (r.ok) toast.success(`Connexion OK • ${r.calendars?.length || 0} calendrier(s)`);
                else toast.error(r.error || "Échec de connexion");
              }} className="gap-1.5">
                <Plug className="h-3.5 w-3.5" /> {testing ? "Test…" : "Tester la connexion"}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Google Health */}
        <AccordionItem value="health" className="border rounded-lg px-4 border-b">
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            Santé (Google Health)
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Google Health Connect (Android) ne fournit pas d'API cloud. La synchronisation utilise l'API <b>Google Fit</b>. Générez un access token OAuth avec les scopes <code>fitness.activity.read fitness.body.read fitness.sleep.read</code> et collez-le ici. Si aucun token n'est fourni, vous pouvez toujours saisir vos données manuellement.
            </p>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={health.enabled} onChange={(e) => setHealth({ ...health, enabled: e.target.checked })} id="ghealth" />
              <Label htmlFor="ghealth">Activer la synchronisation Google Fit</Label>
            </div>
            <div className="space-y-2">
              <Label>Client ID (informatif)</Label>
              <Input value={health.clientId} onChange={(e) => setHealth({ ...health, clientId: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Access Token {health.hasToken && <span className="text-xs text-muted-foreground">(défini)</span>}</Label>
              <Input type="password" value={health.accessToken} onChange={(e) => setHealth({ ...health, accessToken: e.target.value })} placeholder={health.hasToken ? "••••••••" : ""} />
            </div>
            <div className="space-y-2">
              <Label>Refresh Token (optionnel)</Label>
              <Input type="password" value={health.refreshToken} onChange={(e) => setHealth({ ...health, refreshToken: e.target.value })} />
            </div>
            <Button size="sm" onClick={async () => {
              await saveHealthConfig({ enabled: health.enabled, clientId: health.clientId, accessToken: health.accessToken || undefined, refreshToken: health.refreshToken || undefined });
              const c = await loadHealthConfig();
              setHealth((h) => ({ ...h, enabled: c.enabled, clientId: c.clientId, hasToken: c.hasToken, accessToken: "", refreshToken: "" }));
              toast.success("Configuration santé enregistrée");
            }}>Enregistrer</Button>
          </AccordionContent>
        </AccordionItem>

        {/* Identifiants */}
        <AccordionItem value="credentials" className="border rounded-lg px-4 border-b">
          <AccordionTrigger className="text-base font-semibold hover:no-underline">
            Identifiants
          </AccordionTrigger>
          <AccordionContent className="pt-2">
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Modifier" : "Ajouter"} un paramètre</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editParam.name}
                onChange={(e) => setEditParam((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valeur par défaut</Label>
                <Input
                  type="number"
                  value={editParam.defaultValue}
                  onChange={(e) =>
                    setEditParam((p) => ({ ...p, defaultValue: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Incrément</Label>
                <Input
                  type="number"
                  value={editParam.step}
                  onChange={(e) =>
                    setEditParam((p) => ({ ...p, step: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Min</Label>
                <Input
                  type="number"
                  value={editParam.min}
                  onChange={(e) =>
                    setEditParam((p) => ({ ...p, min: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>Max</Label>
                <Input
                  type="number"
                  value={editParam.max}
                  onChange={(e) =>
                    setEditParam((p) => ({ ...p, max: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveParam}>
              {isEditing ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
