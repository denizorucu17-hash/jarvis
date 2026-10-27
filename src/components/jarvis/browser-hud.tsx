import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Mic, RotateCw, Square } from "lucide-react";
import { ArcMark } from "@/components/jarvis/arc-mark";
import { readPage } from "@/lib/jarvis.functions";
import { normalizeBrowse } from "@/lib/jarvis-desk";
import type { Copy } from "@/lib/jarvis-copy";

const START = [
  { label: "İstanbul", url: "https://tr.wikipedia.org/wiki/%C4%B0stanbul" },
  { label: "BBC Türkçe", url: "https://www.bbc.com/turkce" },
  { label: "DuckDuckGo", url: "https://html.duckduckgo.com/html/" },
];

type Page = { title: string; paragraphs: string[]; url: string };

export function BrowserHud(props: {
  c: Copy;
  listening: boolean;
  request: string | null;
  onRequestDone: () => void;
  onClose: () => void;
  onMic: () => void;
}) {
  const { c } = props;
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [page, setPage] = useState<Page | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "fail">("idle");
  const [live, setLive] = useState(false);

  const current = cursor >= 0 ? history[cursor] : null;

  async function load(url: string) {
    setPhase("loading");
    setPage(null);
    try {
      const result = await readPage({ data: { url } });
      if (!result.ok) {
        setPhase("fail");
        return;
      }
      setPage({ title: result.title, paragraphs: result.paragraphs, url: result.finalUrl });
      setDraft(result.finalUrl);
      setPhase("idle");
    } catch {
      setPhase("fail");
    }
  }

  function visit(url: string, push: boolean) {
    setLive(false);
    if (push) {
      const next = history.slice(0, cursor + 1);
      next.push(url);
      setHistory(next.slice(-20));
      setCursor(Math.min(next.length, 20) - 1);
    }
    setDraft(url);
    void load(url);
  }

  useEffect(() => {
    if (!props.request) return;
    visit(props.request, true);
    props.onRequestDone();
    // request is the only trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.request]);

  function go() {
    const url = normalizeBrowse(draft);
    if (!url) return;
    visit(url, true);
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background text-foreground">
      <header className="safe-top flex items-center justify-between gap-3 px-4">
        <p className="wordmark text-sm">{c.browser}</p>
        <div className="flex items-center gap-2">
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
          <button type="button" className="inset h-11 border border-border bg-card px-4 text-sm" onClick={props.onClose}>
            {c.close}
          </button>
        </div>
      </header>
      <form
        className="flex items-center gap-2 px-4 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          go();
        }}
      >
        <button
          type="button"
          className="inset inline-flex size-11 items-center justify-center border border-border bg-card disabled:opacity-40"
          aria-label={c.back}
          disabled={cursor <= 0}
          onClick={() => {
            const url = history[cursor - 1];
            if (!url) return;
            setCursor(cursor - 1);
            visit(url, false);
          }}
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          className="inset inline-flex size-11 items-center justify-center border border-border bg-card disabled:opacity-40"
          aria-label={c.forward}
          disabled={cursor < 0 || cursor >= history.length - 1}
          onClick={() => {
            const url = history[cursor + 1];
            if (!url) return;
            setCursor(cursor + 1);
            visit(url, false);
          }}
        >
          <ArrowRight className="size-4" />
        </button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 300))}
          placeholder={c.browserHint}
          className="inset h-11 min-w-0 flex-1 border border-border bg-field px-3 text-base text-foreground"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button type="submit" className="inset h-11 border border-border bg-card px-3 text-sm">
          {c.go}
        </button>
      </form>
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-3">
        <button
          type="button"
          className="inset inline-flex size-11 items-center justify-center border border-border bg-card disabled:opacity-40"
          aria-label={c.reload}
          disabled={!current}
          onClick={() => current && void load(current)}
        >
          <RotateCw className="size-4" />
        </button>
        <button
          type="button"
          className={`inset h-11 shrink-0 border px-3 text-sm ${live ? "border-border text-muted-foreground" : "border-accent text-foreground"}`}
          onClick={() => setLive(false)}
        >
          {c.reader}
        </button>
        <button
          type="button"
          className={`inset h-11 shrink-0 border px-3 text-sm ${live ? "border-accent text-foreground" : "border-border text-muted-foreground"}`}
          disabled={!current}
          onClick={() => setLive(true)}
        >
          {c.livePage}
        </button>
        <button
          type="button"
          className="inset inline-flex h-11 shrink-0 items-center gap-2 border border-border bg-card px-3 text-sm disabled:opacity-40"
          disabled={!current}
          onClick={() => current && window.open(current, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="size-4" />
          {c.openOut}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {!current && phase !== "loading" ? (
          <div className="mx-auto flex max-w-md flex-col items-center px-2 pt-10 text-center">
            <ArcMark className="mb-5 size-16 text-accent" />
            <p className="text-base text-muted-foreground">{c.browserEmpty}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {START.map((item) => (
                <button
                  key={item.url}
                  type="button"
                  className="inset h-11 border border-border bg-card px-4 text-sm"
                  onClick={() => visit(item.url, true)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {phase === "loading" ? <p className="font-mono text-sm text-muted-foreground">{c.opening}</p> : null}
        {phase === "fail" ? <p className="text-sm text-muted-foreground">{c.pageFail}</p> : null}
        {live && current ? (
          <iframe
            title={page?.title || c.browser}
            src={current}
            className="h-full min-h-[70dvh] w-full border border-border bg-card"
            sandbox="allow-scripts allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        ) : null}
        {!live && page && phase !== "loading" ? (
          <article className="mx-auto max-w-2xl">
            <h1 className="text-xl font-medium tracking-tight">{page.title}</h1>
            <p className="mt-2 truncate font-mono text-xs text-faint">{page.url}</p>
            <div className="mt-5 flex flex-col gap-4">
              {page.paragraphs.map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 24)}`} className="text-base leading-relaxed text-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
