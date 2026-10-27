export type Lang = "tr" | "en";

export type Chip = "aide" | "edge" | "field";

export const VOICES = ["leo", "rex", "ara", "eve", "sal", "aurora"] as const;
export type VoiceId = (typeof VOICES)[number];

export function chipVoice(chip: Chip): VoiceId {
  if (chip === "edge") return "rex";
  if (chip === "field") return "ara";
  return "leo";
}

export type Ctrl =
  | { op: "note"; text: string }
  | { op: "drop"; id: string }
  | { op: "rename"; name: string }
  | { op: "city"; name: string }
  | { op: "focus"; on: boolean }
  | { op: "clear" }
  | { op: "brief" }
  | { op: "mute"; on: boolean }
  | { op: "gloss"; on: boolean }
  | { op: "eye"; on: boolean; scan: boolean }
  | { op: "voice"; id: VoiceId | "next" }
  | { op: "mode"; mode: "flight" | "camera" | "scan" | "armor" | "watch" | "browser" | "off" }
  | { op: "chip"; chip: Chip | "next" };

const CTRL_RE = /\[\[ctrl\s+(\{[\s\S]*?\})\]\]\s*$/;

function cleanSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asCtrl(value: unknown): Ctrl | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.op === "note" && typeof row.text === "string") {
    const text = row.text.trim().slice(0, 140);
    return text ? { op: "note", text } : null;
  }
  if (row.op === "drop" && typeof row.id === "string" && row.id.length < 40) {
    return { op: "drop", id: row.id };
  }
  if (row.op === "rename" && typeof row.name === "string") {
    const name = row.name.trim().slice(0, 24);
    return name ? { op: "rename", name } : null;
  }
  if (row.op === "city" && typeof row.name === "string") {
    const name = row.name.trim().slice(0, 48);
    return name ? { op: "city", name } : null;
  }
  if (row.op === "focus" && typeof row.on === "boolean") {
    return { op: "focus", on: row.on };
  }
  if (row.op === "clear") return { op: "clear" };
  if (row.op === "mute" && typeof row.on === "boolean") return { op: "mute", on: row.on };
  if (row.op === "gloss" && typeof row.on === "boolean") return { op: "gloss", on: row.on };
  if (row.op === "eye" && typeof row.on === "boolean") {
    return { op: "eye", on: row.on, scan: row.scan === true };
  }
  if (row.op === "voice" && (row.id === "next" || VOICES.includes(row.id as VoiceId))) {
    return { op: "voice", id: row.id as VoiceId | "next" };
  }
  if (row.op === "chip" && (row.chip === "aide" || row.chip === "edge" || row.chip === "field" || row.chip === "next")) {
    return { op: "chip", chip: row.chip };
  }
  if (
    row.op === "mode" &&
    (row.mode === "flight" ||
      row.mode === "camera" ||
      row.mode === "scan" ||
      row.mode === "armor" ||
      row.mode === "watch" ||
      row.mode === "browser" ||
      row.mode === "off")
  ) {
    return { op: "mode", mode: row.mode };
  }
  return null;
}

export function splitReply(raw: string): { text: string; ctrl: Ctrl | null } {
  const trimmed = raw.trim();
  const match = trimmed.match(CTRL_RE);
  if (!match || match.index === undefined) {
    return { text: cleanSpeech(trimmed), ctrl: null };
  }
  let ctrl: Ctrl | null = null;
  try {
    ctrl = asCtrl(JSON.parse(match[1] ?? ""));
  } catch {
    ctrl = null;
  }
  const text = cleanSpeech(trimmed.slice(0, match.index));
  return { text, ctrl };
}

export function localIntent(input: string): Ctrl | null {
  const text = input.trim();
  const note = text.match(
    /^(?:kısa bir not al|not al|not et|hatırla|remember|take a note|note)\s*[:：-]?\s+(.+)$/i,
  );
  if (note?.[1]) return { op: "note", text: note[1].trim().slice(0, 140) };

  if (/^(?:odak(?:\s+modunu)?\s+aç|enable focus|focus on|turn focus mode on)$/i.test(text)) {
    return { op: "focus", on: true };
  }
  if (/^(?:odak(?:\s+modunu)?\s+kapat|disable focus|focus off|turn focus mode off)$/i.test(text)) {
    return { op: "focus", on: false };
  }
  if (/^(?:sohbeti temizle|clear chat|reset chat)$/i.test(text)) {
    return { op: "clear" };
  }
  if (/^(?:brifing|durum raporu|günün özeti|briefing|status report)$/i.test(text)) {
    return { op: "brief" };
  }

  const mode = modeIntent(text);
  if (mode) return mode;

  const chip = chipIntent(text);
  if (chip) return chip;

  const voiced = voiceIntent(text);
  if (voiced) return voiced;

  const city =
    text.match(/^(?:şehir(?:i)?|city)\s*[:：]\s*(.+)$/i) ??
    text.match(/^(?:şehri|şehir)\s+(.+?)\s+yap$/i);
  if (city?.[1]) return { op: "city", name: city[1].trim().slice(0, 48) };

  const name =
    text.match(/^(?:bana)\s+(.{1,24}?)\s+de$/i) ?? text.match(/^(?:call me)\s+(.{1,24})$/i);
  if (name?.[1]) return { op: "rename", name: name[1].trim().slice(0, 24) };

  return null;
}

function modeIntent(text: string): Ctrl | null {
  if (/^(?:bölüm\s*3|bolum\s*3|chapter\s*3)$/i.test(text.trim())) {
    return { op: "mode", mode: "armor" };
  }
  if (/(nöbeti?\s+kapat|watch\s+off)/i.test(text)) return { op: "mode", mode: "off" };
  if (/^(?:nöbet|watch)$/i.test(text.trim()) || /(nöbet\s+tut|nöbeti?\s+aç|watch\s+mode|start\s+watch)/i.test(text)) {
    return { op: "mode", mode: "watch" };
  }
  if (/(zırhı\s+kapat|zırhı\s+indir|armor\s+off|close\s+armor)/i.test(text)) {
    return { op: "mode", mode: "off" };
  }
  if (/(zırhı\s+aç|zırh\s+durumu|zırhı\s+çağır|open\s+armor|armor\s+status)/i.test(text)) {
    return { op: "mode", mode: "armor" };
  }
  if (/(uçuşu\s+başlat|uçuş\s+modunu?\s+aç|uçuşa\s+geç|start\s+flight|flight\s+mode|take\s*off)/i.test(text)) {
    return { op: "mode", mode: "flight" };
  }
  if (/(uçuşu\s+(durdur|kapat|bitir)|iniş\s+yap|land\s+now|exit\s+flight|flight\s+off)/i.test(text)) {
    return { op: "mode", mode: "off" };
  }
  if (/(tarayıcıyı\s+kapat|browser\s+off|close\s+(?:the\s+)?browser)/i.test(text)) {
    return { op: "mode", mode: "off" };
  }
  if (
    /^(?:tarayıcı|browser)$/i.test(text.trim()) ||
    /(tarayıcıyı\s+aç|tarayıcı\s+modu|open\s+(?:the\s+)?browser|browser\s+mode)/i.test(text)
  ) {
    return { op: "mode", mode: "browser" };
  }
  if (
    /(kamerayı\s+aç|kameraya\s+eriş|kamerayı\s+bağla|open\s+(the\s+)?camera|access\s+(the\s+)?camera|camera\s+on)/i.test(
      text,
    )
  ) {
    return { op: "mode", mode: "camera" };
  }
  if (/(kamerayı\s+kapat|close\s+(the\s+)?camera|camera\s+off)/i.test(text)) {
    return { op: "eye", on: false, scan: false };
  }
  if (/(tarama\s+başlat|ortamı\s+tara|\bscan\b)/i.test(text)) {
    return { op: "mode", mode: "scan" };
  }
  return null;
}

function voiceIntent(text: string): Ctrl | null {
  const line = text.trim();
  if (/^(?:sesi?\s+değiştir|change\s+voice|next\s+voice)$/i.test(line)) {
    return { op: "voice", id: "next" };
  }
  const named =
    line.match(/^(?:sesi|ses|voice)\s+(leo|rex|ara|eve|sal|aurora)(?:\s+(?:yap|on))?$/i) ??
    line.match(/^(leo|rex|ara|eve|sal|aurora)\s+(?:ses(?:i)?|voice)$/i);
  if (named?.[1] && VOICES.includes(named[1].toLowerCase() as VoiceId)) {
    return { op: "voice", id: named[1].toLowerCase() as VoiceId };
  }
  if (/^(?:sessiz\s+ol|sessize\s+al|sesi\s+kapat|quiet|mute)$/i.test(line)) {
    return { op: "mute", on: true };
  }
  if (/^(?:sesi\s+aç|konuş|unmute)$/i.test(line)) return { op: "mute", on: false };
  if (/^(?:çeviri(?:\s+modu)?|çeviri|çeviriyi?\s+aç|translation(?:\s+on)?|translate)$/i.test(line)) {
    return { op: "gloss", on: true };
  }
  if (/^(?:çeviriyi?\s+kapat|translation\s+off)$/i.test(line)) return { op: "gloss", on: false };
  return null;
}

function chipIntent(text: string): Ctrl | null {
  const line = text.trim();
  if (/^(?:çipi?\s+değiştir|sonraki\s+çip|change\s+(?:the\s+)?chip|next\s+chip)$/i.test(line)) {
    return { op: "chip", chip: "next" };
  }
  if (
    /^(?:(?:ultron|ültron|volt)(?:\s+çip(?:i|ine)?)?(?:\s+(?:geç|ol|aç))?|(?:volta|ultrona|ültrona)\s+geç|keskin\s+çip(?:e\s+geç)?|switch\s+to\s+volt)$/i.test(
      line,
    )
  ) {
    return { op: "chip", chip: "edge" };
  }
  if (
    /^(?:(?:friday|fraydey|freydey|mira)(?:\s+çip(?:i|ine)?)?(?:\s+(?:geç|ol|aç))?|(?:friday'?e|fraydey'?e|miraya)\s+geç|saha\s+çip(?:i(?:ne)?)?(?:\s+geç)?|switch\s+to\s+mira)$/i.test(
      line,
    )
  ) {
    return { op: "chip", chip: "field" };
  }
  if (
    /^(?:(?:jarvis|carvis)(?:\s+çip(?:i|ine)?)?(?:\s+(?:geç|ol|aç))?|(?:jarvis'?e|carvis'?e)\s+geç|atölye\s+çip(?:i(?:ne)?)?(?:\s+geç)?|sakin\s+çip|switch\s+to\s+jarvis)$/i.test(
      line,
    )
  ) {
    return { op: "chip", chip: "aide" };
  }
  return null;
}

export function forSpeech(text: string): string {
  return text.replace(/J\.A\.R\.V\.I\.S\./gi, "Carvis").replace(/\bjarvis\b/gi, "Carvis");
}

export function clipForSpeech(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 480) return clean;
  const cut = clean.slice(0, 480).replace(/\s+\S*$/, "");
  return `${cut}.`;
}
