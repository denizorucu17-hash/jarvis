import type { Lang } from "@/lib/jarvis-protocol";

export type Desk =
  | { kind: "memory"; text: string }
  | { kind: "forget"; text: string }
  | { kind: "recall" }
  | { kind: "timer"; ms: number }
  | { kind: "timerOff" }
  | { kind: "remind"; text: string; at: number }
  | { kind: "rates" }
  | { kind: "news" }
  | { kind: "search"; query: string }
  | { kind: "route"; place: string }
  | { kind: "draft"; text: string }
  | { kind: "live"; on: boolean }
  | { kind: "browse"; url: string };

const MAX_TIMER = 3 * 60 * 60 * 1000;

function unitMs(amount: number, unit: string): number | null {
  const name = unit.toLowerCase();
  let ms = 0;
  if (name.startsWith("sn") || name.startsWith("san") || name.startsWith("sec")) ms = amount * 1000;
  else if (name.startsWith("dk") || name.startsWith("dak") || name.startsWith("min")) ms = amount * 60_000;
  else if (name.startsWith("saat") || name.startsWith("hour")) ms = amount * 3_600_000;
  else return null;
  if (ms < 5_000 || ms > MAX_TIMER) return null;
  return ms;
}

function clockAt(now: number, hour: number, minute: number, tomorrow: boolean): number | null {
  if (hour > 23 || minute > 59) return null;
  const when = new Date(now);
  when.setSeconds(0, 0);
  when.setHours(hour, minute, 0, 0);
  if (tomorrow || when.getTime() <= now) when.setDate(when.getDate() + 1);
  return when.getTime();
}

function timed(body: string, now: number): { text: string; at: number } | null {
  const later = body.match(/^(\d{1,3})\s*(dakika|dk|saat|minutes?|hours?)\s+sonra\s+(.+)$/i);
  if (later?.[1] && later[2] && later[3]) {
    const ms = unitMs(Number(later[1]), later[2]);
    const text = later[3].trim().slice(0, 140);
    if (ms && text) return { text, at: now + ms };
  }
  const tomorrow = body.match(
    /^yarın\s+saat\s+(\d{1,2})(?:[:.](\d{2}))?\s*['’]?(?:e|a|da|de|te|ta)?\s+(.+)$/i,
  );
  if (tomorrow?.[1] && tomorrow[3]) {
    const at = clockAt(now, Number(tomorrow[1]), Number(tomorrow[2] ?? "0"), true);
    const text = tomorrow[3].trim().slice(0, 140);
    if (at && text) return { text, at };
  }
  const today = body.match(/^saat\s+(\d{1,2})(?:[:.](\d{2}))?\s*['’]?(?:da|de|te|ta|e|a)?\s+(.+)$/i);
  if (today?.[1] && today[3]) {
    const at = clockAt(now, Number(today[1]), Number(today[2] ?? "0"), false);
    const text = today[3].trim().slice(0, 140);
    if (at && text) return { text, at };
  }
  return null;
}

export function normalizeBrowse(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > 300) return null;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.toString();
    } catch {
      return null;
    }
  }
  const host = text.replace(/\s+sitesini$/i, "").trim();
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(host)) return `https://${host}`;
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(text)}`;
}

export function deskIntent(input: string, now: number): Desk | null {
  const line = input.trim().replace(/\s+/g, " ");
  if (!line) return null;

  if (/^(?:konuşmayı\s+kapat|konuşma\s+modunu\s+kapat|live\s+off|stop\s+talking)$/i.test(line)) {
    return { kind: "live", on: false };
  }
  if (/^(?:konuşma\s+modu|konuşmayı\s+aç|sürekli\s+konuş|live\s+talk|keep\s+talking)$/i.test(line)) {
    return { kind: "live", on: true };
  }
  if (/^(?:zamanlayıcıyı\s+(?:durdur|kapat|iptal)|sayaç\s+dur|timer\s+off|stop\s+timer)$/i.test(line)) {
    return { kind: "timerOff" };
  }

  const namedTimer = line.match(
    /^(?:zamanlayıcı|sayaç|timer)\s+(\d{1,3})\s*(saniye|sn|dakika|dk|saat|seconds?|minutes?|hours?)$/i,
  );
  const spokenTimer = line.match(
    /^(\d{1,3})\s*(saniye|sn|dakika|dk|saat|seconds?|minutes?|hours?)\s+(?:say|sayaç|zamanlayıcı|timer)$/i,
  );
  const timer = namedTimer ?? spokenTimer;
  if (timer?.[1] && timer[2]) {
    const ms = unitMs(Number(timer[1]), timer[2]);
    if (ms) return { kind: "timer", ms };
  }

  const memory = line.match(
    /^(?:hafızana\s+(?:yaz|kaydet|al)|aklında\s+tut|remember(?:\s+that)?|save\s+to\s+memory)\s*[:：-]?\s+(.+)$/i,
  );
  if (memory?.[1]) return { kind: "memory", text: memory[1].trim().slice(0, 160) };

  const forget = line.match(/^(?:hafızadan\s+sil|bunu\s+unut)\s*[:：-]?\s+(.+)$/i);
  if (forget?.[1]) return { kind: "forget", text: forget[1].trim().slice(0, 160) };

  if (/^(?:hafızayı\s+(?:oku|göster|söyle)|hafızam(?:ı)?|memory)$/i.test(line)) return { kind: "recall" };

  if (
    /^(?:dolar|euro|sterlin|döviz|kur(?:lar)?|dollar|exchange(?:\s+rates?)?)(?:\s+ne\s+kadar|\s+kuru)?$/i.test(
      line,
    )
  ) {
    return { kind: "rates" };
  }
  if (/^(?:haberler|son\s+dakika|günün\s+haberleri|headlines|news)$/i.test(line)) return { kind: "news" };

  const search =
    line.match(/^(?:internette\s+(?:ara|bak)|webde\s+ara|şunu\s+ara|search)\s*[:：]?\s+(.+)$/i) ??
    line.match(/^(?:maç(?:\s+sonucu)?|son\s+skor)(?:\s+(.+))?$/i);
  if (search) {
    const query = (search[1] || "bugünün maç sonuçları").trim().slice(0, 160);
    if (query) return { kind: "search", query };
  }

  const route =
    line.match(/^(?:yol\s+tarifi|haritada\s+aç|directions?\s+to)\s*[:：]?\s+(.+)$/i) ??
    line.match(/^(.+?)\s+(?:için\s+)?yol\s+tarifi$/i);
  if (route?.[1]) return { kind: "route", place: route[1].trim().slice(0, 80) };

  const draft = line.match(/^(?:mesaj(?:ı)?\s+yaz|mesaj\s+taslağı|whatsapp(?:\s+taslağı)?)\s*[:：]?\s+(.+)$/i);
  if (draft?.[1]) return { kind: "draft", text: draft[1].trim().slice(0, 280) };

  const site = line.match(/^(?:site(?:yi)?\s+aç|tarayıcıda\s+aç|adresi\s+aç|open\s+site)\s+(.+)$/i);
  if (site?.[1]) {
    const url = normalizeBrowse(site[1]);
    if (url) return { kind: "browse", url };
  }

  const reminder = timed(line, now);
  if (reminder) return { kind: "remind", ...reminder };

  const loose = line.match(/^(?:anımsatıcı(?:\s+kur)?|hatırlat(?:ıcı)?|remind(?:\s+me)?)\s*[:：]?\s+(.+)$/i);
  if (loose?.[1]) {
    const body = loose[1].trim();
    const parsed = timed(body, now);
    if (parsed) return { kind: "remind", ...parsed };
    return { kind: "remind", text: body.slice(0, 140), at: now + 60 * 60 * 1000 };
  }

  return null;
}

export function whenLabel(at: number, language: Lang): string {
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

function who(language: Lang, callName: string): string {
  return callName || (language === "tr" ? "Efendim" : "sir");
}

export function memorySaved(language: Lang, callName: string): string {
  const name = who(language, callName);
  return language === "tr" ? `Hafızaya yazdım, ${name}.` : `Saved to memory, ${name}.`;
}

export function memorySpoken(items: string[], language: Lang, callName: string): string {
  const name = who(language, callName);
  if (items.length === 0) {
    return language === "tr" ? `Hafıza boş, ${name}.` : `Memory is empty, ${name}.`;
  }
  const list = items.slice(0, 6).join(". ");
  return language === "tr" ? `Hafızamda şunlar var, ${name}. ${list}.` : `In memory, ${name}. ${list}.`;
}

export function memoryForgot(found: boolean, language: Lang, callName: string): string {
  const name = who(language, callName);
  if (!found) return language === "tr" ? `Eşleşen kayıt yok, ${name}.` : `Nothing matched, ${name}.`;
  return language === "tr" ? `Hafızadan sildim, ${name}.` : `Removed from memory, ${name}.`;
}

export function timerSpoken(ms: number, language: Lang, callName: string): string {
  const name = who(language, callName);
  const minutes = Math.round(ms / 60000);
  const seconds = Math.round(ms / 1000);
  if (language === "tr") {
    const span = ms >= 60_000 ? `${minutes} dakika` : `${seconds} saniye`;
    return `${span} sayıyorum, ${name}.`;
  }
  const span = ms >= 60_000 ? `${minutes} minutes` : `${seconds} seconds`;
  return `Counting ${span}, ${name}.`;
}

export function timerDone(language: Lang, callName: string): string {
  const name = who(language, callName);
  return language === "tr" ? `Süre doldu, ${name}.` : `Time is up, ${name}.`;
}

export function timerStopped(language: Lang, callName: string): string {
  const name = who(language, callName);
  return language === "tr" ? `Zamanlayıcı durdu, ${name}.` : `Timer stopped, ${name}.`;
}

export function remindSpoken(text: string, at: number, language: Lang, callName: string): string {
  const name = who(language, callName);
  const when = whenLabel(at, language);
  return language === "tr"
    ? `Anımsatıcı kuruldu, ${name}. ${when}, ${text}.`
    : `Reminder set, ${name}. ${when}, ${text}.`;
}

export function remindDue(text: string, language: Lang): string {
  return language === "tr" ? `Anımsatıcı: ${text}.` : `Reminder: ${text}.`;
}

export function liveSpoken(on: boolean, language: Lang, callName: string): string {
  const name = who(language, callName);
  if (language === "tr") return on ? `Konuşma açık, ${name}. Bitince yine dinlerim.` : `Konuşma kapandı, ${name}.`;
  return on ? `Live talk is on, ${name}. I will listen again after I finish.` : `Live talk is off, ${name}.`;
}

export function routeSpoken(place: string, language: Lang, callName: string): string {
  const name = who(language, callName);
  return language === "tr"
    ? `${place} için yol tarifini açıyorum, ${name}. Göndermedim, siz onaylarsınız.`
    : `Opening directions to ${place}, ${name}. Nothing is sent until you confirm.`;
}

export function draftSpoken(language: Lang, callName: string): string {
  const name = who(language, callName);
  return language === "tr"
    ? `Taslak hazır, ${name}. Göndermedim. WhatsApp ya da mesajı siz açarsınız.`
    : `Draft ready, ${name}. I did not send it. You open WhatsApp or messages.`;
}

export function newsSpoken(titles: string[], language: Lang): string {
  if (titles.length === 0) return language === "tr" ? "Başlık gelmedi." : "No headlines came back.";
  const body = titles.map((title, index) => `${index + 1}. ${title}`).join(" ");
  return language === "tr" ? `Son başlıklar. ${body}` : `Headlines. ${body}`;
}

export function browseSpoken(language: Lang, callName: string): string {
  const name = who(language, callName);
  return language === "tr" ? `Sayfayı açıyorum, ${name}.` : `Opening the page, ${name}.`;
}
