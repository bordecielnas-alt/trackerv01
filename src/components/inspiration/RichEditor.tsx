import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bold, Italic, UnderlineIcon, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote, Link2, Image as ImageIcon, Table as TableIcon,
  AlignLeft, AlignCenter, AlignRight, Undo, Redo, Highlighter, Palette, Minus
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#000000"];

export default function RichEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: true, autolink: true, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer", class: "text-primary underline" } }),
      Image,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60vh] px-6 py-4",
      },
    },
  });

  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border rounded-lg bg-card overflow-hidden flex flex-col">
      <Toolbar editor={editor} />
      <div className="overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL du lien", prev || "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const addImage = () => {
    const url = window.prompt("URL de l'image");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };
  const addTable = () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30 sticky top-0 z-10">
      <TBtn onClick={() => editor.chain().focus().undo().run()} title="Annuler"><Undo className="h-4 w-4" /></TBtn>
      <TBtn onClick={() => editor.chain().focus().redo().run()} title="Refaire"><Redo className="h-4 w-4" /></TBtn>
      <Sep />
      <TBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></TBtn>
      <Sep />
      <TBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-4 w-4" /></TBtn>
      <Sep />
      <TBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></TBtn>
      <TBtn onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></TBtn>
      <Sep />
      <TBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="h-4 w-4" /></TBtn>
      <TBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="h-4 w-4" /></TBtn>
      <Sep />
      <TBtn active={editor.isActive("link")} onClick={setLink}><Link2 className="h-4 w-4" /></TBtn>
      <TBtn onClick={addImage}><ImageIcon className="h-4 w-4" /></TBtn>
      <TBtn onClick={addTable}><TableIcon className="h-4 w-4" /></TBtn>
      <Sep />
      <ColorPicker icon={<Palette className="h-4 w-4" />} colors={COLORS} onPick={(c) => editor.chain().focus().setColor(c).run()} onClear={() => editor.chain().focus().unsetColor().run()} />
      <ColorPicker icon={<Highlighter className="h-4 w-4" />} colors={COLORS} onPick={(c) => editor.chain().focus().toggleHighlight({ color: c }).run()} onClear={() => editor.chain().focus().unsetHighlight().run()} />
    </div>
  );
}

function TBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <Button type="button" size="sm" variant="ghost" title={title} onClick={onClick}
      className={cn("h-8 w-8 p-0", active && "bg-accent text-accent-foreground")}>
      {children}
    </Button>
  );
}
function Sep() { return <Separator orientation="vertical" className="h-6 mx-0.5" />; }

function ColorPicker({ icon, colors, onPick, onClear }: { icon: React.ReactNode; colors: string[]; onPick: (c: string) => void; onClear: () => void }) {
  return (
    <div className="relative group">
      <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0">{icon}</Button>
      <div className="absolute top-full left-0 mt-1 hidden group-hover:flex gap-1 p-2 bg-popover border rounded-md shadow-md z-20">
        {colors.map((c) => (
          <button key={c} onClick={() => onPick(c)} className="w-5 h-5 rounded border" style={{ background: c }} />
        ))}
        <button onClick={onClear} className="w-5 h-5 rounded border bg-background text-xs">×</button>
      </div>
    </div>
  );
}
