import { useEffect, useRef, useState } from "react";
import RichEditor from "@/components/inspiration/RichEditor";
import { loadInspiration, saveInspiration } from "@/lib/inspiration-store";
import { Lightbulb, Check, Loader2 } from "lucide-react";

export default function InspirationPage() {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    loadInspiration().then((d) => { setContent(d.html || ""); setLoaded(true); });
  }, []);

  const handleChange = (html: string) => {
    setContent(html);
    setStatus("saving");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await saveInspiration(html);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1500);
    }, 800);
  };

  if (!loaded) return <div className="p-6 text-muted-foreground">Chargement…</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Lightbulb className="h-6 w-6 text-secondary" /> Inspiration</h1>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 h-6">
          {status === "saving" && (<><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enregistrement…</>)}
          {status === "saved" && (<><Check className="h-3.5 w-3.5 text-primary" /> Enregistré</>)}
        </div>
      </div>
      <RichEditor content={content} onChange={handleChange} />
    </div>
  );
}
