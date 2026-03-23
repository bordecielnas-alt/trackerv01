import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  getSettings,
  saveSettings,
  type TrackingParameter,
  type TrackingSettings,
} from "@/lib/tracking-store";

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

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const handleSaveFormula = () => {
    saveSettings(settings);
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

  const handleDelete = (id: string) => {
    const updated = { ...settings, parameters: settings.parameters.filter((p) => p.id !== id) };
    setSettings(updated);
    saveSettings(updated);
    toast.success("Paramètre supprimé");
  };

  const handleSaveParam = () => {
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
    saveSettings(updated);
    setDialogOpen(false);
    toast.success(isEditing ? "Paramètre modifié" : "Paramètre ajouté");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Réglages</h1>

      {/* Parameters list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Paramètres</CardTitle>
          <Button onClick={openAdd} size="sm" className="gap-1">
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Score formula */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Formule de score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
        </CardContent>
      </Card>

      {/* Param dialog */}
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
