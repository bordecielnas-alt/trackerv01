import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  action: "edit" | "delete";
  onPick: (scope: "single" | "series") => void;
}

export default function RecurrenceScopeDialog({ open, onOpenChange, action, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Évènement récurrent</DialogTitle>
          <DialogDescription>
            {action === "edit" ? "Modifier uniquement cette occurrence ou toute la série ?" : "Supprimer uniquement cette occurrence ou toute la série ?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-col">
          <Button variant="outline" onClick={() => { onPick("single"); onOpenChange(false); }}>Cette occurrence seulement</Button>
          <Button variant={action === "delete" ? "destructive" : "default"} onClick={() => { onPick("series"); onOpenChange(false); }}>
            Toute la série
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
