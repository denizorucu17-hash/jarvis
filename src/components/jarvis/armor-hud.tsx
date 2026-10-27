import { Mic, Square } from "lucide-react";
import { ArcMark } from "@/components/jarvis/arc-mark";
import type { Copy } from "@/lib/jarvis-copy";

export function ArmorHud(props: {
  c: Copy;
  chip: string;
  city: string;
  listening: boolean;
  onClose: () => void;
  onMic: () => void;
}) {
  const { c } = props;
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-4">
        <span className="absolute top-0 left-0 size-8 border-t border-l border-accent" />
        <span className="absolute top-0 right-0 size-8 border-t border-r border-accent" />
        <span className="absolute bottom-0 left-0 size-8 border-b border-l border-accent" />
        <span className="absolute right-0 bottom-0 size-8 border-r border-b border-accent" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ArcMark className="arc-spin size-40 text-accent" />
      </div>
      <header className="safe-top relative flex items-center justify-between px-5">
        <p className="wordmark text-sm">{c.armor}</p>
        <p className="font-mono text-xs text-muted-foreground">{props.city || "—"}</p>
      </header>
      <dl className="relative mt-8 grid grid-cols-3 px-5 font-mono text-sm">
        <div>
          <dt className="text-xs text-faint">{c.core}</dt>
          <dd className="text-lg">{c.nominal}</dd>
        </div>
        <div className="text-center">
          <dt className="text-xs text-faint">{c.seal}</dt>
          <dd className="text-lg">{c.sealed}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-faint">{c.chips}</dt>
          <dd className="truncate text-lg">{props.chip}</dd>
        </div>
      </dl>
      <div className="safe-bottom absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 px-5">
        <button
          type="button"
          className="inset h-11 border border-border bg-card px-5 text-sm"
          onClick={props.onClose}
        >
          {c.stow}
        </button>
        <button
          type="button"
          className={`inset inline-flex size-11 items-center justify-center border bg-card ${
            props.listening ? "border-accent text-accent" : "border-border"
          }`}
          onClick={props.onMic}
          aria-label={props.listening ? c.stop : c.mic}
        >
          {props.listening ? <Square className="size-4" /> : <Mic className="size-5" />}
        </button>
      </div>
    </div>
  );
}
