import { Mic, Square } from "lucide-react";
import { ArcMark } from "@/components/jarvis/arc-mark";
import type { Copy } from "@/lib/jarvis-copy";

export function WatchHud(props: {
  c: Copy;
  now: number | null;
  city: string;
  sky: string | null;
  note: string | null;
  listening: boolean;
  onClose: () => void;
  onMic: () => void;
}) {
  const { c } = props;
  const clock =
    props.now === null
      ? "——:——"
      : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
          props.now,
        );
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background text-foreground">
      <header className="safe-top flex items-center justify-between px-5">
        <p className="wordmark text-sm">{c.watch}</p>
        <p className="font-mono text-xs text-muted-foreground">{props.city || "—"}</p>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <ArcMark className="mb-6 size-16 text-accent" />
        <p className="font-mono text-5xl tabular-nums">{clock}</p>
        <p className="mt-4 text-base text-muted-foreground">{props.sky || c.unknownWeather}</p>
        {props.note ? <p className="mt-6 max-w-md text-base">{props.note}</p> : null}
      </div>
      <div className="safe-bottom flex items-center justify-center gap-3 px-5">
        <button type="button" className="inset h-11 border border-border bg-card px-5 text-sm" onClick={props.onClose}>
          {c.close}
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
