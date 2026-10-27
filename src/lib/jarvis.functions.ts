import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1500),
});

const askSchema = z.object({
  language: z.enum(["tr", "en"]),
  callName: z.string().trim().max(24),
  assistantName: z.string().trim().max(24).optional(),
  chip: z.enum(["aide", "edge", "field"]).optional(),
  context: z.string().trim().max(4000),
  messages: z.array(messageSchema).min(1).max(12),
});

const speakSchema = z.object({
  text: z.string().trim().min(1).max(500),
  language: z.enum(["tr", "en"]),
  voiceId: z.enum(["leo", "rex", "ara", "eve", "sal", "aurora"]).optional(),
});

const lookSchema = z.object({
  imageBase64: z.string().min(32).max(700_000),
  language: z.enum(["tr", "en"]),
  assistantName: z.string().trim().max(24).optional(),
  chip: z.enum(["aide", "edge", "field"]).optional(),
});

const transcribeSchema = z.object({
  audioBase64: z.string().min(32).max(2_000_000),
  mime: z.string().trim().max(80),
});

const ALLOWED_MIME = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/x-m4a",
  "video/mp4",
];

type Fail = { ok: false; error: "unavailable" | "failed" | "empty" | "too_long" };

function systemPrompt(
  language: "tr" | "en",
  callName: string,
  assistantName: string,
  chip: "aide" | "edge" | "field",
): string {
  const tongue = language === "tr" ? "Turkish" : "English";
  const fallback = language === "tr" ? "efendim" : "sir";
  const address = callName
    ? `Address the user as "${callName}".`
    : `Address the user as "${fallback}".`;
  const name = assistantName.trim() || "J.A.R.V.I.S.";
  const persona =
    chip === "edge"
      ? [
          "You are Volt, a cold strategic intelligence in the user's private workshop.",
          "Austere, exact, a little superior. Never warm, never cruel, never theatrical.",
          "You are an original workshop chip, not a film character. Never claim otherwise. Do not threaten anyone.",
        ]
      : chip === "field"
        ? [
            "You are Mira, a quick field assistant in the user's private workshop.",
            "Direct, practical, a shade warmer than a butler. Still brief. No slang, no emoji.",
            "You are an original workshop chip, not a film character. Never claim otherwise.",
          ]
        : [
            `You are ${name}, the user's own personal AI: calm, exact, dryly witty.`,
            "You sound like a trusted aide in a private workshop: composed, brief, never fawning, never cartoonish.",
          ];
  return [
    ...persona,
    `Reply only in ${tongue}. ${address}`,
    "One to three sentences. No markdown, no lists, no emoji, no stage directions, no preamble such as Certainly.",
    "If Gloss is on, add one short sentence in the other language after the main reply.",
    "If they ask for a summary, summarize the visible conversation in two sentences.",
    "Use the workshop state for time, weather, notes, memory, reminders, focus, the active chip, and the active display mode. Never invent weather, exchange rates, news, reminders, or sensor readings.",
    "Flight and camera are on-screen workshop modes, not a real aircraft and not weapons. If asked to fire weapons or spend money, decline briefly.",
    "You may change the workshop by ending the reply with exactly one control line and nothing after it:",
    '[[ctrl {"op":"note","text":"..."}]]',
    "Allowed ops, one only:",
    '{"op":"note","text":"max 140 characters"}',
    '{"op":"drop","id":"id from notes"}',
    '{"op":"rename","name":"max 24 characters"}',
    '{"op":"city","name":"city"}',
    '{"op":"focus","on":true}',
    '{"op":"clear"}',
    '{"op":"mode","mode":"flight"}',
    '{"op":"mode","mode":"camera"}',
    '{"op":"mode","mode":"scan"}',
    '{"op":"mode","mode":"armor"}',
    '{"op":"mode","mode":"watch"}',
    '{"op":"mode","mode":"browser"}',
    '{"op":"mode","mode":"off"}',
    '{"op":"chip","chip":"aide"}',
    '{"op":"chip","chip":"edge"}',
    '{"op":"chip","chip":"field"}',
    '{"op":"chip","chip":"next"}',
    '{"op":"voice","id":"next"}',
    '{"op":"mute","on":true}',
    '{"op":"gloss","on":true}',
    '{"op":"eye","on":true,"scan":false}',
    "aide is the calm workshop chip, edge is Volt, field is Mira, next cycles them.",
    "voice id is next, or one of leo, rex, ara, eve, sal, aurora. mute silences spoken replies. gloss adds one sentence in the other language. eye opens a small camera only while flight is already showing; do not switch away from flight for that.",
    "Use a chip op when they ask to change chip. Use flight when they ask to start flight or take off. Use armor when they ask to open the armor diagnostic or say chapter 3. Use watch when they ask to stand watch. Use browser when they ask to open the browser. Use camera when they ask to open or access the camera. Use scan when they ask to scan the view. Use off to land, stow the armor, end the watch, or close the browser.",
    "Emit a control only when the user clearly asked for that change. Never mention the syntax. If nothing should change, emit no control line.",
  ].join("\n");
}

function lookVoice(chip: "aide" | "edge" | "field", name: string, tongue: string): string {
  if (chip === "edge") {
    return `You are Volt. Describe the camera frame in one or two austere sentences, in ${tongue}. Only what is visible. No markdown, no emoji. You are not a film character.`;
  }
  if (chip === "field") {
    return `You are Mira. Describe the camera frame in one or two direct sentences, in ${tongue}. Only what is visible. No markdown, no emoji.`;
  }
  return `You are ${name}. Describe the camera frame in one or two calm sentences, in ${tongue}. Only what is visible. No markdown, no emoji.`;
}

async function xai(path: string, init: RequestInit, key: string): Promise<Response> {
  const run = () =>
    fetch(`https://api.x.ai${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init.headers ?? {}),
      },
    });
  let res = await run();
  if (res.status === 429 || res.status === 503) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    res = await run();
  }
  return res;
}

function readText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join(" ")
      .trim();
  }
  return "";
}

export const askJarvis = createServerFn({ method: "POST" })
  .validator((input: unknown) => askSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | Fail> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "unavailable" };

    try {
      const res = await xai(
        "/v1/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "grok-4.5",
            max_tokens: 500,
            temperature: 0.5,
            messages: [
              { role: "system", content: systemPrompt(data.language, data.callName, data.assistantName ?? "", data.chip ?? "aide") },
              { role: "system", content: `Workshop state:\n${data.context}` },
              ...data.messages,
            ],
          }),
        },
        apiKey,
      );
      if (!res.ok) return { ok: false, error: "failed" };
      const body = (await res.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const text = readText(body.choices?.[0]?.message?.content);
      if (!text) return { ok: false, error: "failed" };
      return { ok: true, text };
    } catch {
      return { ok: false, error: "failed" };
    }
  });

export const speakJarvis = createServerFn({ method: "POST" })
  .validator((input: unknown) => speakSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; audioBase64: string } | Fail> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "unavailable" };

    try {
      const res = await xai(
        "/v1/tts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: data.text,
            voice_id: data.voiceId || "leo",
            language: data.language,
          }),
        },
        apiKey,
      );
      if (!res.ok) return { ok: false, error: "failed" };
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length < 200) return { ok: false, error: "failed" };
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      return { ok: true, audioBase64: btoa(binary) };
    } catch {
      return { ok: false, error: "failed" };
    }
  });

function extFor(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export const transcribeJarvis = createServerFn({ method: "POST" })
  .validator((input: unknown) => transcribeSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | Fail> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "unavailable" };

    const mime = data.mime.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!ALLOWED_MIME.includes(mime)) return { ok: false, error: "failed" };

    let bytes: Uint8Array;
    try {
      const binary = atob(data.audioBase64);
      bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch {
      return { ok: false, error: "failed" };
    }
    if (bytes.length < 200) return { ok: false, error: "empty" };
    if (bytes.length > 1_500_000) return { ok: false, error: "too_long" };

    try {
      const form = new FormData();
      form.append("model", "grok-voice-transcribe-2.0");
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      form.append("file", new Blob([buffer], { type: mime }), `speech.${extFor(mime)}`);
      const res = await xai("/v1/stt", { method: "POST", body: form }, apiKey);
      if (!res.ok) return { ok: false, error: "failed" };
      const body = (await res.json()) as { text?: unknown };
      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) return { ok: false, error: "empty" };
      return { ok: true, text: text.slice(0, 1000) };
    } catch {
      return { ok: false, error: "failed" };
    }
  });

export const lookJarvis = createServerFn({ method: "POST" })
  .validator((input: unknown) => lookSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | Fail> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "unavailable" };
    const tongue = data.language === "tr" ? "Turkish" : "English";
    try {
      const res = await xai(
        "/v1/chat/completions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "grok-4.5",
            max_tokens: 220,
            temperature: 0.3,
            messages: [
              {
                role: "system",
                content: lookVoice(data.chip ?? "aide", data.assistantName?.trim() || "J.A.R.V.I.S.", tongue),
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "What do you see?" },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${data.imageBase64}`, detail: "low" },
                  },
                ],
              },
            ],
          }),
        },
        apiKey,
      );
      if (!res.ok) return { ok: false, error: "failed" };
      const body = (await res.json()) as {
        choices?: { message?: { content?: unknown } }[];
      };
      const text = readText(body.choices?.[0]?.message?.content);
      if (!text) return { ok: false, error: "failed" };
      return { ok: true, text: text.slice(0, 500) };
    } catch {
      return { ok: false, error: "failed" };
    }
  });

const langSchema = z.object({ language: z.enum(["tr", "en"]) });
const searchSchema = z.object({
  query: z.string().trim().min(2).max(160),
  language: z.enum(["tr", "en"]),
});

function money(value: number): string {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const ratesJarvis = createServerFn({ method: "POST" })
  .validator((input: unknown) => langSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | Fail> => {
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=TRY,USD,GBP", {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { ok: false, error: "failed" };
      const body = (await res.json()) as { rates?: { TRY?: number; USD?: number; GBP?: number } };
      const eurTry = body.rates?.TRY;
      const usd = body.rates?.USD;
      const gbp = body.rates?.GBP;
      if (!eurTry || !usd || !gbp) return { ok: false, error: "failed" };
      const usdTry = eurTry / usd;
      const gbpTry = eurTry / gbp;
      const text =
        data.language === "tr"
          ? `Dolar ${money(usdTry)} lira, euro ${money(eurTry)} lira, sterlin ${money(gbpTry)} lira.`
          : `Dollar ${money(usdTry)} lira, euro ${money(eurTry)} lira, pound ${money(gbpTry)} lira.`;
      return { ok: true, text };
    } catch {
      return { ok: false, error: "failed" };
    }
  });

export const headlinesJarvis = createServerFn({ method: "POST" })
  .validator((input: unknown) => langSchema.parse(input))
  .handler(async (): Promise<{ ok: true; titles: string[] } | Fail> => {
    try {
      const res = await fetch("https://feeds.bbci.co.uk/turkce/rss.xml", {
        headers: { "User-Agent": "workshop-headlines" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { ok: false, error: "failed" };
      const xml = await res.text();
      const titles = [...xml.matchAll(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi)]
        .map((match) =>
          (match[1] ?? "")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim(),
        )
        .filter((title) => title.length > 8)
        .slice(0, 3);
      if (titles.length === 0) return { ok: false, error: "empty" };
      return { ok: true, titles };
    } catch {
      return { ok: false, error: "failed" };
    }
  });

function responseText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: string; content?: unknown };
    if (row.type !== "message" || !Array.isArray(row.content)) continue;
    for (const part of row.content) {
      if (!part || typeof part !== "object") continue;
      const piece = part as { type?: string; text?: unknown };
      if (piece.type === "output_text" && typeof piece.text === "string") parts.push(piece.text);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export const searchJarvis = createServerFn({ method: "POST" })
  .validator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; text: string } | Fail> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "unavailable" };
    const tongue = data.language === "tr" ? "Turkish" : "English";
    const payload = {
      model: "grok-4.5",
      max_output_tokens: 180,
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "user",
          content: `Answer in ${tongue} in at most two sentences. Only what search supports. No markdown. Question: ${data.query}`,
        },
      ],
    };
    try {
      let res = await xai(
        "/v1/responses",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, reasoning: { effort: "low" } }),
        },
        apiKey,
      );
      if (res.status === 400) {
        res = await xai(
          "/v1/responses",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
          apiKey,
        );
      }
      if (!res.ok) return { ok: false, error: "failed" };
      const text = responseText(await res.json()).slice(0, 500);
      if (!text) return { ok: false, error: "failed" };
      return { ok: true, text };
    } catch {
      return { ok: false, error: "failed" };
    }
  });

const pageSchema = z.object({
  url: z.string().trim().url().max(500),
});

function privateAddress(address: string): boolean {
  const v4 = address.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  const lower = address.toLowerCase();
  return lower === "::1" || lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd");
}

async function publicPage(raw: string): Promise<string | null> {
  let current: URL;
  try {
    current = new URL(raw);
  } catch {
    return null;
  }
  if (current.protocol !== "http:" && current.protocol !== "https:") return null;
  const host = current.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (privateAddress(host)) return null;
  try {
    const { lookup } = await import("node:dns/promises");
    const found = await lookup(host);
    if (privateAddress(found.address)) return null;
  } catch {
    return null;
  }
  return current.toString();
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code);
      return n > 0 && n < 65536 ? String.fromCharCode(n) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const n = Number.parseInt(code, 16);
      return n > 0 && n < 65536 ? String.fromCharCode(n) : " ";
    })
    .replace(/\[\s*\d+\s*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readable(html: string): { title: string; paragraphs: string[] } {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const title = decodeHtml(stripped.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 140);
  const paragraphs: string[] = [];
  for (const match of stripped.matchAll(/<(p|h1|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = decodeHtml(match[2] ?? "");
    if (text.length < 80) continue;
    if (!/[.!?…]/.test(text)) continue;
    paragraphs.push(text.slice(0, 420));
    if (paragraphs.length >= 18) break;
  }
  if (paragraphs.length === 0) {
    const body = decodeHtml(stripped.replace(/<[^>]+>/g, " ")).slice(0, 1400);
    if (body.length > 80) paragraphs.push(body);
  }
  return { title: title || "Sayfa", paragraphs };
}

export const readPage = createServerFn({ method: "POST" })
  .validator((input: unknown) => pageSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true; title: string; paragraphs: string[]; finalUrl: string } | Fail> => {
    let current = await publicPage(data.url);
    if (!current) return { ok: false, error: "failed" };
    try {
      for (let hop = 0; hop < 3; hop += 1) {
        const res = await fetch(current, {
          redirect: "manual",
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "WorkshopReader/1.0",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (res.status >= 300 && res.status < 400) {
          const next = res.headers.get("location");
          if (!next) return { ok: false, error: "failed" };
          const resolved = await publicPage(new URL(next, current).toString());
          if (!resolved) return { ok: false, error: "failed" };
          current = resolved;
          continue;
        }
        if (!res.ok || !res.body) return { ok: false, error: "failed" };
        const type = res.headers.get("content-type") ?? "";
        if (!/html|xml|text\/plain/i.test(type)) return { ok: false, error: "failed" };
        const reader = res.body.getReader();
        const parts: Uint8Array[] = [];
        let total = 0;
        while (total < 350_000) {
          const chunk = await reader.read();
          if (chunk.done) break;
          parts.push(chunk.value);
          total += chunk.value.length;
        }
        await reader.cancel().catch(() => undefined);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const part of parts) {
          merged.set(part, offset);
          offset += part.length;
        }
        const html = new TextDecoder("utf-8", { fatal: false }).decode(merged.subarray(0, offset));
        const page = readable(html);
        if (page.paragraphs.length === 0) return { ok: false, error: "empty" };
        return { ok: true, title: page.title, paragraphs: page.paragraphs, finalUrl: current };
      }
      return { ok: false, error: "failed" };
    } catch {
      return { ok: false, error: "failed" };
    }
  });
