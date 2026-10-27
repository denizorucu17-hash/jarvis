import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Image as ImageIcon, Mic, PanelRight, Square, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { ArcMark } from "@/components/jarvis/arc-mark";
import { armCamera, CameraHud } from "@/components/jarvis/camera-hud";
import { ArmorHud } from "@/components/jarvis/armor-hud";
import { claimFlight, FlightHud } from "@/components/jarvis/flight-hud";
import { WatchHud } from "@/components/jarvis/watch-hud";
import { BrowserHud } from "@/components/jarvis/browser-hud";
import { askJarvis, headlinesJarvis, lookJarvis, ratesJarvis, searchJarvis, speakJarvis, transcribeJarvis } from "@/lib/jarvis.functions";
import { pickRecorderMime, playMp3, primeAudio, speakNative, stopAudio } from "@/lib/jarvis-audio";
import { briefingLine, clearedLine, chipLine, copy, eyeLine, glossLine, modeLine, quietLine, voiceLine, type Copy } from "@/lib/jarvis-copy";
import { clipForSpeech, forSpeech, localIntent, splitReply, VOICES, type Chip, type Lang, type VoiceId } from "@/lib/jarvis-protocol";
import {
  deskIntent,
  draftSpoken,
  liveSpoken,
  memoryForgot,
  memorySaved,
  memorySpoken,
  newsSpoken,
  browseSpoken,
  remindDue,
  remindSpoken,
  routeSpoken,
  timerDone,
  timerSpoken,
  timerStopped,
  whenLabel,
  type Desk,
} from "@/lib/jarvis-desk";
import { nextId, useJarvis, type Msg } from "@/lib/jarvis-store";
import { loadWeather, type Weather } from "@/lib/weather";

type Phase = "idle" | "listening" | "transcribing" | "thinking" | "speaking";
type Fail = "mic" | "hear" | "down" | "unavailable" | "camera" | null;

type SpeechResult = { isFinal: boolean; [index: number]: { transcript: string } };
type SpeechEv = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechEv) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function speechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function clock(now: number | null): string {
  if (now === null) return "——:——";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

function dateLine(now: number | null, language: Lang): string {
  if (now === null) return "—";
  return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

function workshopContext(input: {
  language: Lang;
  city: string;
  callName: string;
  focus: boolean;
  notes: { id: string; text: string }[];
  weather: Weather | null;
  now: number | null;
  hud: string;
  chip: Chip;
  gloss: boolean;
  memories: string[];
  reminders: { text: string; at: number }[];
}): string {
  const when =
    input.now === null
      ? "unknown"
      : new Intl.DateTimeFormat(input.language === "tr" ? "tr-TR" : "en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
          hourCycle: "h23",
        }).format(input.now);
  const sky = input.weather
    ? `${input.weather.temp}°C, ${input.weather.label}, wind ${input.weather.wind} km/h`
    : "unknown";
  const notes = input.notes.length
    ? input.notes.map((note) => `- ${note.id}: ${note.text}`).join("\n")
    : "none";
  const memory = input.memories.length ? input.memories.slice(0, 8).map((item) => `- ${item}`).join("\n") : "none";
  const reminders = input.reminders.length
    ? input.reminders
        .slice(0, 4)
        .map((item) => `- ${whenLabel(item.at, input.language)}: ${item.text}`)
        .join("\n")
    : "none";
  return [
    `Local time: ${when}`,
    `City: ${input.city || "unknown"}`,
    `Weather: ${sky}`,
    `Focus mode: ${input.focus ? "on" : "off"}`,
    `Call name: ${input.callName || "(none)"}`,
    `Display mode: ${input.hud}`,
    `Chip: ${input.chip}`,
    `Gloss: ${input.gloss ? "on" : "off"}`,
    `Notes:\n${notes}`,
    `Memory:\n${memory}`,
    `Reminders:\n${reminders}`,
  ].join("\n");
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 960;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.72).split(",")[1] ?? "";
      if (data.length < 32) reject(new Error("small"));
      else resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

export function JarvisApp() {
  const language = useJarvis((s) => s.language);
  const callName = useJarvis((s) => s.callName);
  const assistantName = useJarvis((s) => s.assistantName);
  const city = useJarvis((s) => s.city);
  const notes = useJarvis((s) => s.notes);
  const focus = useJarvis((s) => s.focus);
  const voiceReplies = useJarvis((s) => s.voiceReplies);
  const messages = useJarvis((s) => s.messages);
  const hud = useJarvis((s) => s.hud);
  const chip = useJarvis((s) => s.chip);
  const voiceId = useJarvis((s) => s.voiceId);
  const gloss = useJarvis((s) => s.gloss);
  const eye = useJarvis((s) => s.eye);
  const lookTick = useJarvis((s) => s.lookTick);
  const memories = useJarvis((s) => s.memories);
  const reminders = useJarvis((s) => s.reminders);
  const liveTalk = useJarvis((s) => s.liveTalk);
  const timerUntil = useJarvis((s) => s.timerUntil);
  const setLanguage = useJarvis((s) => s.setLanguage);
  const setCallName = useJarvis((s) => s.setCallName);
  const setAssistantName = useJarvis((s) => s.setAssistantName);
  const setCity = useJarvis((s) => s.setCity);
  const setFocus = useJarvis((s) => s.setFocus);
  const setVoiceReplies = useJarvis((s) => s.setVoiceReplies);
  const push = useJarvis((s) => s.push);
  const replaceMessages = useJarvis((s) => s.replaceMessages);
  const removeNote = useJarvis((s) => s.removeNote);
  const addMemory = useJarvis((s) => s.addMemory);
  const removeMemory = useJarvis((s) => s.removeMemory);
  const addReminder = useJarvis((s) => s.addReminder);
  const removeReminder = useJarvis((s) => s.removeReminder);
  const setLiveTalk = useJarvis((s) => s.setLiveTalk);
  const setTimerUntil = useJarvis((s) => s.setTimerUntil);
  const applyCtrl = useJarvis((s) => s.applyCtrl);

  const c: Copy = copy[language];
  const aiName =
    chip === "edge" ? "Volt" : chip === "field" ? "Mira" : assistantName.trim() || "J.A.R.V.I.S.";
  const chipLabel = chip === "edge" ? c.chipEdge : chip === "field" ? c.chipField : c.chipAide;
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [partial, setPartial] = useState("");
  const [fail, setFail] = useState<Fail>(null);
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [cameraBoot, setCameraBoot] = useState<Promise<MediaStream> | null>(null);
  const [outbound, setOutbound] = useState<{ kind: "map" | "draft"; text: string } | null>(null);
  const [browseRequest, setBrowseRequest] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);
  const listenRef = useRef<() => void>(() => undefined);
  const lastSpokenRef = useRef("");
  const voiceRef = useRef<(text: string, id: string, ticket: number) => Promise<void>>(async () => undefined);
  const timerGuard = useRef<number | null>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const gen = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const heardRef = useRef(false);
  const modeRef = useRef<"web" | "rec" | null>(null);
  const submitRef = useRef<(text?: string) => Promise<void>>(async () => undefined);

  useEffect(() => {
    document.documentElement.lang = language === "tr" ? "tr" : "en";
  }, [language]);

  useEffect(() => {
    document.title = aiName;
  }, [aiName]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!timerUntil) return;
    const id = window.setInterval(() => {
      if (Date.now() < timerUntil || timerGuard.current === timerUntil) return;
      timerGuard.current = timerUntil;
      setTimerUntil(null);
      const state = useJarvis.getState();
      const line = timerDone(state.language, state.callName);
      const reply: Msg = { id: nextId(), role: "jarvis", text: line };
      state.push(reply);
      const ticket = gen.current + 1;
      gen.current = ticket;
      void voiceRef.current(line, reply.id, ticket);
    }, 400);
    return () => window.clearInterval(id);
  }, [timerUntil, setTimerUntil]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const state = useJarvis.getState();
      const due = state.reminders.find((item) => item.at <= Date.now());
      if (!due) return;
      state.removeReminder(due.id);
      const line = remindDue(due.text, state.language);
      const reply: Msg = { id: nextId(), role: "jarvis", text: line };
      state.push(reply);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(state.assistantName.trim() || "Atölye", { body: due.text });
        } catch {
          /* notification can fail quietly */
        }
      }
      const ticket = gen.current + 1;
      gen.current = ticket;
      void voiceRef.current(line, reply.id, ticket);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const name = city.trim();
    if (!name) return;
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void loadWeather(name, language, ac.signal)
        .then((next) => {
          if (!ac.signal.aborted) setWeather(next);
        })
        .catch(() => {
          if (!ac.signal.aborted) setWeather(null);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [city, language]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, phase, partial]);

  useEffect(() => {
    return () => {
      stopAudio();
      abortRef.current?.abort();
      recRef.current?.abort();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function interrupt() {
    gen.current += 1;
    abortRef.current?.abort();
    stopAudio();
  }

  function releaseMic() {
    recRef.current?.abort();
    recRef.current = null;
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    modeRef.current = null;
  }

  async function voiceFor(text: string, messageId: string, ticket: number) {
    lastSpokenRef.current = text;
    const finish = () => {
      if (gen.current !== ticket) return;
      setPhase("idle");
      if (!useJarvis.getState().liveTalk) return;
      window.setTimeout(() => {
        if (gen.current !== ticket || !useJarvis.getState().liveTalk || phaseRef.current !== "idle") return;
        listenRef.current();
      }, 400);
    };
    if (!useJarvis.getState().voiceReplies) {
      finish();
      return;
    }
    setPhase("speaking");
    const clip = clipForSpeech(forSpeech(text));
    const lang = useJarvis.getState().language;
    try {
      const spoken = await speakJarvis({
        data: { text: clip, language: lang, voiceId: useJarvis.getState().voiceId },
      });
      if (gen.current !== ticket) return;
      if (spoken.ok) await playMp3(spoken.audioBase64);
      else await speakNative(clip, lang);
      finish();
    } catch {
      if (gen.current !== ticket) return;
      setReplayId(messageId);
      finish();
    }
  }

  voiceRef.current = voiceFor;

  function openFlightEye(scan: boolean) {
    if (!useJarvis.getState().eye) {
      try {
        setCameraBoot(armCamera());
      } catch {
        setFail("camera");
      }
    }
    applyCtrl({ op: "eye", on: true, scan });
  }

  function toggleFlightEye() {
    if (useJarvis.getState().eye) {
      setCameraBoot(null);
      applyCtrl({ op: "eye", on: false, scan: false });
      return;
    }
    openFlightEye(false);
  }

  async function handleDesk(desk: Desk, ticket: number) {
    const state = useJarvis.getState();
    const language = state.language;
    const callName = state.callName;
    let line = "";
    if (desk.kind === "memory") {
      addMemory(desk.text);
      line = memorySaved(language, callName);
    } else if (desk.kind === "forget") {
      const query = desk.text.toLocaleLowerCase("tr");
      const hits = state.memories.filter((item) => item.text.toLocaleLowerCase("tr").includes(query));
      hits.forEach((item) => removeMemory(item.id));
      line = memoryForgot(hits.length > 0, language, callName);
    } else if (desk.kind === "recall") {
      line = memorySpoken(
        state.memories.map((item) => item.text),
        language,
        callName,
      );
    } else if (desk.kind === "timer") {
      timerGuard.current = null;
      setTimerUntil(Date.now() + desk.ms);
      line = timerSpoken(desk.ms, language, callName);
    } else if (desk.kind === "timerOff") {
      setTimerUntil(null);
      line = timerStopped(language, callName);
    } else if (desk.kind === "remind") {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        void Notification.requestPermission().catch(() => undefined);
      }
      addReminder(desk.text, desk.at);
      line = remindSpoken(desk.text, desk.at, language, callName);
    } else if (desk.kind === "live") {
      setLiveTalk(desk.on);
      line = liveSpoken(desk.on, language, callName);
    } else if (desk.kind === "route") {
      setOutbound({ kind: "map", text: desk.place });
      const query = encodeURIComponent(desk.place);
      const apple = /iPhone|iPad|Macintosh/i.test(navigator.userAgent);
      window.open(
        apple ? `https://maps.apple.com/?daddr=${query}` : `https://www.google.com/maps/dir/?api=1&destination=${query}`,
        "_blank",
        "noopener,noreferrer",
      );
      line = routeSpoken(desk.place, language, callName);
    } else if (desk.kind === "draft") {
      setOutbound({ kind: "draft", text: desk.text });
      line = draftSpoken(language, callName);
    } else if (desk.kind === "browse") {
      applyCtrl({ op: "mode", mode: "browser" });
      setBrowseRequest(desk.url);
      line = browseSpoken(language, callName);
    } else if (desk.kind === "rates") {
      setPhase("thinking");
      const result = await ratesJarvis({ data: { language } });
      line = result.ok ? result.text : language === "tr" ? "Kuru alamadım." : "I couldn't read the rates.";
    } else if (desk.kind === "news") {
      setPhase("thinking");
      const result = await headlinesJarvis({ data: { language } });
      line = result.ok ? newsSpoken(result.titles, language) : newsSpoken([], language);
    } else {
      setPhase("thinking");
      const result = await searchJarvis({ data: { query: desk.query, language } });
      if (gen.current !== ticket) return;
      if (!result.ok) {
        setFail(result.error === "unavailable" ? "unavailable" : "down");
        setPhase("idle");
        return;
      }
      line = result.text;
    }
    if (gen.current !== ticket || !line) return;
    const reply: Msg = { id: nextId(), role: "jarvis", text: line };
    push(reply);
    await voiceFor(line, reply.id, ticket);
  }

  async function submit(raw?: string) {
    const text = (raw ?? draft).trim();
    if (!text) return;
    if (phaseRef.current === "listening" || phaseRef.current === "transcribing") releaseMic();
    const ticket = gen.current + 1;
    gen.current = ticket;
    abortRef.current?.abort();
    stopAudio();
    setDraft("");
    setPartial("");
    setFail(null);
    setReplayId(null);
    if (boxRef.current) boxRef.current.style.height = "";

    const intent = localIntent(text);
    if (intent?.op === "clear") {
      const line = clearedLine(useJarvis.getState().language, useJarvis.getState().callName);
      const reply: Msg = { id: nextId(), role: "jarvis", text: line };
      replaceMessages([reply]);
      await voiceFor(line, reply.id, ticket);
      return;
    }

    const user: Msg = { id: nextId(), role: "user", text };
    push(user);
    const desk = deskIntent(text, Date.now());
    if (desk) {
      await handleDesk(desk, ticket);
      return;
    }
    if (intent?.op === "brief" || /^bölüm\s*3$/i.test(text)) {
      if (/^bölüm\s*3$/i.test(text)) applyCtrl({ op: "mode", mode: "armor" });
      const state = useJarvis.getState();
      const line = briefingLine({
        language: state.language,
        callName: state.callName,
        city: state.city,
        temp: weather?.temp ?? null,
        sky: weather?.label ?? null,
        notes: state.notes.length,
        chip: state.chip === "edge" ? "Volt" : state.chip === "field" ? "Mira" : state.assistantName.trim() || "J.A.R.V.I.S.",
        now,
      });
      const reply: Msg = { id: nextId(), role: "jarvis", text: line };
      push(reply);
      await voiceFor(line, reply.id, ticket);
      return;
    }
    if (intent?.op === "voice" || intent?.op === "gloss" || intent?.op === "mute") {
      const muteAfter = intent.op === "mute" && intent.on;
      if (!muteAfter) applyCtrl(intent);
      const state = useJarvis.getState();
      const line =
        intent.op === "voice"
          ? voiceLine(state.voiceId, state.language, state.callName)
          : intent.op === "mute"
            ? quietLine(intent.on, state.language, state.callName)
            : glossLine(intent.on, state.language, state.callName);
      const reply: Msg = { id: nextId(), role: "jarvis", text: line };
      push(reply);
      await voiceFor(line, reply.id, ticket);
      if (muteAfter) applyCtrl(intent);
      return;
    }
    if (intent?.op === "eye" && !intent.on) {
      const hudNow = useJarvis.getState().hud;
      setCameraBoot(null);
      if (hudNow === "flight") {
        applyCtrl(intent);
        const state = useJarvis.getState();
        const line = eyeLine(false, state.language, state.callName);
        const reply: Msg = { id: nextId(), role: "jarvis", text: line };
        push(reply);
        await voiceFor(line, reply.id, ticket);
        return;
      }
      if (hudNow === "camera") {
        applyCtrl({ op: "mode", mode: "off" });
        const state = useJarvis.getState();
        const line = modeLine("off", state.language, state.callName);
        const reply: Msg = { id: nextId(), role: "jarvis", text: line };
        push(reply);
        await voiceFor(line, reply.id, ticket);
        return;
      }
    }
    if (
      intent?.op === "mode" &&
      (intent.mode === "camera" || intent.mode === "scan") &&
      useJarvis.getState().hud === "flight"
    ) {
      openFlightEye(intent.mode === "scan");
      if (intent.mode === "scan") {
        setPhase("idle");
        return;
      }
      const state = useJarvis.getState();
      const line = eyeLine(true, state.language, state.callName);
      const reply: Msg = { id: nextId(), role: "jarvis", text: line };
      push(reply);
      await voiceFor(line, reply.id, ticket);
      return;
    }
    if (intent?.op === "mode") {
      if (intent.mode === "flight") claimFlight();
      if (intent.mode === "camera" || intent.mode === "scan") {
        try {
          setCameraBoot(armCamera());
        } catch {
          setFail("camera");
        }
      }
      if (intent.mode === "off") setCameraBoot(null);
      applyCtrl(intent);
      const state = useJarvis.getState();
      const line = modeLine(intent.mode, state.language, state.callName);
      const reply: Msg = { id: nextId(), role: "jarvis", text: line };
      push(reply);
      if (intent.mode === "camera" || intent.mode === "scan") {
        setPhase("idle");
        return;
      }
      await voiceFor(line, reply.id, ticket);
      return;
    }
    if (intent?.op === "chip") {
      applyCtrl(intent);
      const state = useJarvis.getState();
      const line = chipLine(state.chip, state.language, state.callName, state.assistantName);
      const reply: Msg = { id: nextId(), role: "jarvis", text: line };
      push(reply);
      await voiceFor(line, reply.id, ticket);
      return;
    }
    if (intent) applyCtrl(intent);

    setPhase("thinking");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const state = useJarvis.getState();
      const history = state.messages.slice(-12).map((message) => ({
        role: message.role === "jarvis" ? ("assistant" as const) : ("user" as const),
        content: message.text,
      }));
      const result = await askJarvis({
        data: {
          language: state.language,
          callName: state.callName,
          assistantName: state.assistantName,
          chip: state.chip,
          context: workshopContext({
            language: state.language,
            city: state.city,
            callName: state.callName,
            focus: state.focus,
            notes: state.notes,
            weather,
            now,
            hud: state.hud,
            chip: state.chip,
            gloss: state.gloss,
            memories: state.memories.map((item) => item.text),
            reminders: state.reminders,
          }),
          messages: history,
        },
        signal: ac.signal,
      });
      if (gen.current !== ticket) return;
      if (!result.ok) {
        setFail(result.error === "unavailable" ? "unavailable" : "down");
        setPhase("idle");
        return;
      }
      const parsed = splitReply(result.text);
      const spoken = parsed.text || (state.language === "tr" ? "Anlaşıldı." : "Understood.");
      if (!intent && parsed.ctrl) {
        if (parsed.ctrl.op === "clear") {
          const reply: Msg = { id: nextId(), role: "jarvis", text: spoken };
          replaceMessages([reply]);
          await voiceFor(spoken, reply.id, ticket);
          return;
        }
        const flying = useJarvis.getState().hud === "flight";
        if (parsed.ctrl.op === "eye" && parsed.ctrl.on && flying) {
          openFlightEye(parsed.ctrl.scan);
        } else if (
          parsed.ctrl.op === "mode" &&
          (parsed.ctrl.mode === "camera" || parsed.ctrl.mode === "scan") &&
          flying
        ) {
          openFlightEye(parsed.ctrl.mode === "scan");
        } else {
          if (parsed.ctrl.op === "mode" && parsed.ctrl.mode === "flight") claimFlight();
          if (parsed.ctrl.op === "mode" && (parsed.ctrl.mode === "camera" || parsed.ctrl.mode === "scan")) {
            try {
              setCameraBoot(armCamera());
            } catch {
              setFail("camera");
            }
          }
          if (parsed.ctrl.op === "mode" && parsed.ctrl.mode === "off") setCameraBoot(null);
          applyCtrl(parsed.ctrl);
        }
      }
      const reply: Msg = { id: nextId(), role: "jarvis", text: spoken };
      push(reply);
      await voiceFor(spoken, reply.id, ticket);
    } catch (error) {
      if (gen.current !== ticket) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFail("down");
      setPhase("idle");
    }
  }

  submitRef.current = submit;

  async function finishRecording() {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;
    const blob = await new Promise<Blob>((resolve) => {
      rec.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      };
      rec.stop();
    });
    recorderRef.current = null;
    modeRef.current = null;
    if (blob.size < 200) {
      setFail("hear");
      setPhase("idle");
      return;
    }
    setPhase("transcribing");
    try {
      const audioBase64 = await blobToBase64(blob);
      const result = await transcribeJarvis({
        data: { audioBase64, mime: blob.type || "audio/webm" },
      });
      if (!result.ok || !result.text.trim()) {
        setFail(result.ok ? "hear" : result.error === "unavailable" ? "unavailable" : "hear");
        setPhase("idle");
        return;
      }
      await submitRef.current(result.text.trim());
    } catch {
      setFail("hear");
      setPhase("idle");
    }
  }

  async function startRecorder() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      rec.start();
      recorderRef.current = rec;
      modeRef.current = "rec";
      setPhase("listening");
      window.setTimeout(() => {
        if (recorderRef.current === rec && rec.state === "recording") void finishRecording();
      }, 18000);
    } catch {
      setFail("mic");
      setPhase("idle");
    }
  }

  function startWeb(): boolean {
    const Ctor = speechCtor();
    if (!Ctor) return false;
    const rec = new Ctor();
    rec.lang = language === "tr" ? "tr-TR" : "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    heardRef.current = false;
    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const row = event.results[i];
        const piece = row?.[0]?.transcript ?? "";
        if (row?.isFinal) finalText += piece;
        else interim += piece;
      }
      if (interim) setPartial(interim);
      const spoken = finalText.trim();
      if (spoken && !heardRef.current) {
        heardRef.current = true;
        setPartial("");
        void submitRef.current(spoken);
      }
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setFail("mic");
        setPhase("idle");
        modeRef.current = null;
        return;
      }
      if (event.error === "aborted") return;
      if (event.error === "no-speech") {
        setFail("hear");
        setPhase("idle");
        return;
      }
      rec.abort();
      void startRecorder();
    };
    rec.onend = () => {
      if (modeRef.current === "web" && !heardRef.current && phaseRef.current === "listening") {
        setPhase("idle");
      }
      if (modeRef.current === "web") modeRef.current = null;
    };
    try {
      rec.start();
      recRef.current = rec;
      modeRef.current = "web";
      setPhase("listening");
      return true;
    } catch {
      return false;
    }
  }

  async function onMic() {
    primeAudio();
    if (phaseRef.current === "speaking" || phaseRef.current === "thinking") interrupt();
    if (phaseRef.current === "listening") {
      if (modeRef.current === "rec") {
        await finishRecording();
        return;
      }
      recRef.current?.stop();
      return;
    }
    if (phaseRef.current === "transcribing") return;
    setFail(null);
    setPartial("");
    if (!startWeb()) await startRecorder();
  }

  listenRef.current = () => {
    void onMic();
  };

  async function onPhoto(file: File) {
    if (!file.type.startsWith("image/")) return;
    const ticket = gen.current + 1;
    gen.current = ticket;
    abortRef.current?.abort();
    stopAudio();
    setFail(null);
    const user: Msg = { id: nextId(), role: "user", text: language === "tr" ? "Fotoğraf" : "Photo" };
    push(user);
    setPhase("thinking");
    try {
      const imageBase64 = await compressImage(file);
      const state = useJarvis.getState();
      const result = await lookJarvis({
        data: {
          imageBase64,
          language: state.language,
          assistantName: state.chip === "aide" ? state.assistantName : state.chip === "edge" ? "Volt" : "Mira",
          chip: state.chip,
        },
      });
      if (gen.current !== ticket) return;
      if (!result.ok) {
        setFail(result.error === "unavailable" ? "unavailable" : "down");
        setPhase("idle");
        return;
      }
      const reply: Msg = { id: nextId(), role: "jarvis", text: result.text };
      push(reply);
      await voiceFor(result.text, reply.id, ticket);
    } catch {
      if (gen.current !== ticket) return;
      setFail("camera");
      setPhase("idle");
    }
  }

  async function replay(message: Msg) {
    primeAudio();
    const ticket = gen.current + 1;
    gen.current = ticket;
    setReplayId(null);
    await voiceFor(message.text, message.id, ticket);
  }

  function onSeen(text: string) {
    const reply: Msg = { id: nextId(), role: "jarvis", text };
    push(reply);
    const ticket = gen.current + 1;
    gen.current = ticket;
    void voiceFor(text, reply.id, ticket);
  }

  function closeHud() {
    const state = useJarvis.getState();
    if (state.hud === "off") return;
    state.applyCtrl({ op: "mode", mode: "off" });
    setCameraBoot(null);
    const line = modeLine("off", state.language, state.callName);
    const reply: Msg = { id: nextId(), role: "jarvis", text: line };
    push(reply);
    const ticket = gen.current + 1;
    gen.current = ticket;
    void voiceFor(line, reply.id, ticket);
  }

  const status =
    phase === "listening"
      ? c.listening
      : phase === "transcribing"
        ? c.transcribing
        : phase === "thinking"
          ? c.thinking
          : phase === "speaking"
            ? c.speaking
            : c.online;

  const failText =
    fail === "mic"
      ? c.micDenied
      : fail === "hear"
        ? c.hearFail
        : fail === "unavailable"
          ? c.unavailable
          : fail === "down"
            ? c.aiDown
            : fail === "camera"
              ? c.camDenied
              : null;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="safe-top flex items-center gap-3 border-b border-border px-4 pb-3">
        <ArcMark className="size-9 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="wordmark truncate text-sm text-foreground">{aiName}</p>
          <p className="truncate font-mono text-xs text-faint">{chipLabel}</p>
        </div>
        <p
          className={`ml-auto font-mono text-sm tabular-nums text-muted-foreground ${
            phase === "idle" ? "" : "status-shimmer"
          }`}
        >
          {clock(now)}
          <span className="ml-3 hidden text-xs md:inline">{status}</span>
        </p>
        <button
          type="button"
          className="inset h-11 min-w-11 border border-border px-3 font-mono text-xs text-foreground"
          onClick={() => setLanguage(language === "tr" ? "en" : "tr")}
          aria-label={c.lang}
        >
          {language === "tr" ? "TR" : "EN"}
        </button>
        <button
          type="button"
          className="inset inline-flex size-11 items-center justify-center border border-border text-foreground lg:hidden"
          onClick={() => setSystemsOpen(true)}
          aria-label={c.systems}
        >
          <PanelRight className="size-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center px-4 pt-10 text-center sm:pt-16">
                  <ArcMark className="arc-spin mb-6 size-36 text-accent sm:size-44" />
                  <h1 className="text-2xl font-medium tracking-tight">{aiName}</h1>
                  <p className="mt-2 text-base text-muted-foreground">{c.greeting}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.hint}</p>
                </div>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={message.role === "user" ? "flex flex-col items-end gap-2" : "flex flex-col gap-2"}
                    data-testid={message.role === "jarvis" ? "jarvis-reply" : "user-line"}
                  >
                    <p className="font-mono text-xs tracking-widest text-faint uppercase">
                      {message.role === "user" ? c.you : aiName}
                    </p>
                    <p
                      className={
                        message.role === "user"
                          ? "inset max-w-[68ch] bg-card px-4 py-3 text-base leading-normal"
                          : `max-w-[68ch] leading-normal ${focus ? "text-lg" : "text-base"}`
                      }
                    >
                      {message.text}
                    </p>
                    {message.role === "jarvis" && replayId === message.id ? (
                      <button
                        type="button"
                        className="inset inline-flex h-11 items-center gap-2 border border-border px-3 text-sm text-foreground"
                        onClick={() => void replay(message)}
                      >
                        <Volume2 className="size-4" />
                        {c.replay}
                      </button>
                    ) : null}
                  </article>
                ))
              )}
              {partial ? (
                <p className="font-mono text-sm text-muted-foreground">{partial}</p>
              ) : null}
              <div ref={endRef} />
            </div>
          </div>

          <div className="safe-bottom border-t border-border px-4 pt-3 sm:px-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
              {focus ? null : (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {c.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="inset h-11 shrink-0 border border-border px-4 text-sm text-muted-foreground"
                      onClick={() => {
                        primeAudio();
                        void submit(suggestion);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              {timerUntil ? (
                <div className="flex items-center justify-between border border-border bg-card px-3">
                  <p className="font-mono text-sm tabular-nums text-foreground">
                    {(() => {
                      const total = Math.max(0, Math.ceil((timerUntil - (now ?? Date.now())) / 1000));
                      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
                    })()}
                  </p>
                  <button
                    type="button"
                    className="h-11 px-3 text-sm text-foreground"
                    onClick={() => {
                      primeAudio();
                      void submit(language === "tr" ? "zamanlayıcıyı durdur" : "stop timer");
                    }}
                  >
                    {c.timerStop}
                  </button>
                </div>
              ) : null}
              {outbound ? (
                <div className="flex flex-col gap-2 border border-border bg-card p-3">
                  <p className="text-sm text-muted-foreground">
                    {outbound.kind === "draft" ? c.draftReady : outbound.text}
                  </p>
                  {outbound.kind === "draft" ? <p className="text-sm text-foreground">{outbound.text}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {outbound.kind === "map" ? (
                      <button
                        type="button"
                        className="inset h-11 border border-accent px-4 text-sm"
                        onClick={() => {
                          const query = encodeURIComponent(outbound.text);
                          const apple = /iPhone|iPad|Macintosh/i.test(navigator.userAgent);
                          window.open(
                            apple
                              ? `https://maps.apple.com/?daddr=${query}`
                              : `https://www.google.com/maps/dir/?api=1&destination=${query}`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }}
                      >
                        {c.openMap}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="inset h-11 border border-border px-4 text-sm"
                          onClick={() =>
                            window.open(
                              `https://wa.me/?text=${encodeURIComponent(outbound.text)}`,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          {c.whatsapp}
                        </button>
                        <button
                          type="button"
                          className="inset h-11 border border-border px-4 text-sm"
                          onClick={() => {
                            window.location.href = `sms:?&body=${encodeURIComponent(outbound.text)}`;
                          }}
                        >
                          {c.sms}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="inset h-11 border border-border px-4 text-sm text-muted-foreground"
                      onClick={() => setOutbound(null)}
                    >
                      {c.dismiss}
                    </button>
                  </div>
                </div>
              ) : null}
              {failText ? (
                <p className="text-sm text-muted-foreground" role="alert">
                  {failText}
                </p>
              ) : null}
              <form
                className="shell flex items-end gap-2 border border-border bg-card"
                data-testid="composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  primeAudio();
                  void submit();
                }}
              >
                <label className="sr-only" htmlFor="ask">
                  {c.placeholder}
                </label>
                <textarea
                  id="ask"
                  ref={boxRef}
                  rows={1}
                  value={draft}
                  placeholder={phase === "listening" ? c.listening : c.placeholder}
                  className="inset max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-base text-foreground placeholder:text-faint"
                  onChange={(event) => {
                    setDraft(event.target.value.slice(0, 1000));
                    const el = event.target;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      primeAudio();
                      void submit();
                    }
                  }}
                />
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void onPhoto(file);
                  }}
                />
                <button
                  type="button"
                  className="inset inline-flex size-11 shrink-0 items-center justify-center border border-border text-foreground disabled:opacity-40"
                  aria-label={c.photo}
                  disabled={phase === "thinking" || phase === "transcribing"}
                  onClick={() => {
                    primeAudio();
                    photoRef.current?.click();
                  }}
                >
                  <ImageIcon className="size-5" />
                </button>
                <button
                  type="button"
                  className={`inset inline-flex size-11 shrink-0 items-center justify-center border ${
                    phase === "listening"
                      ? "border-accent text-accent"
                      : "border-border text-foreground"
                  }`}
                  onClick={() => void onMic()}
                  aria-label={phase === "listening" ? c.stop : c.mic}
                  disabled={phase === "transcribing"}
                >
                  {phase === "listening" ? <Square className="size-4" /> : <Mic className="size-5" />}
                </button>
                <button
                  type="submit"
                  className="inset inline-flex size-11 shrink-0 items-center justify-center bg-primary text-primary-foreground disabled:opacity-40"
                  aria-label={c.send}
                  disabled={!draft.trim() || phase === "thinking" || phase === "transcribing"}
                >
                  <ArrowUp className="size-5" />
                </button>
              </form>
            </div>
          </div>
        </main>

        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border p-4 lg:block">
          <Workshop
            c={c}
            now={now}
            language={language}
            city={city}
            callName={callName}
            assistantName={assistantName}
            chip={chip}
            notes={notes}
            focus={focus}
            voiceReplies={voiceReplies}
            voiceId={voiceId}
            gloss={gloss}
            memories={memories}
            reminders={reminders}
            liveTalk={liveTalk}
            weather={weather}
            onCity={setCity}
            onCallName={setCallName}
            onAssistantName={setAssistantName}
            onChip={(phrase) => {
              primeAudio();
              void submit(phrase);
            }}
            onPhrase={(phrase) => {
              primeAudio();
              void submit(phrase);
            }}
            onGloss={(on) => {
              primeAudio();
              void submit(
                language === "tr" ? (on ? "çeviriyi aç" : "çeviriyi kapat") : on ? "translation on" : "translation off",
              );
            }}
            onFocus={setFocus}
            onVoice={setVoiceReplies}
            onLive={(on) => {
              primeAudio();
              void submit(language === "tr" ? (on ? "konuşma modu" : "konuşmayı kapat") : on ? "live talk" : "live off");
            }}
            onRemove={removeNote}
            onRemoveMemory={removeMemory}
            onRemoveReminder={removeReminder}
            onClear={() => {
              primeAudio();
              void submit(language === "tr" ? "Sohbeti temizle" : "Clear chat");
            }}
          />
        </aside>
      </div>

      {systemsOpen ? (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="absolute inset-0 bg-background/80"
            onClick={() => setSystemsOpen(false)}
            role="presentation"
          />
          <div className="sheet-in absolute inset-y-0 right-0 flex w-[min(100%,22rem)] flex-col overflow-y-auto border-l border-border bg-background">
            <div className="safe-top flex justify-end px-4">
              <button
                type="button"
                className="inset inline-flex size-11 items-center justify-center border border-border"
                onClick={() => setSystemsOpen(false)}
                aria-label={c.close}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="safe-bottom px-4 pb-4">
              <Workshop
                c={c}
                now={now}
                language={language}
                city={city}
                callName={callName}
                assistantName={assistantName}
                chip={chip}
                notes={notes}
                focus={focus}
                voiceReplies={voiceReplies}
                voiceId={voiceId}
                gloss={gloss}
                memories={memories}
                reminders={reminders}
                liveTalk={liveTalk}
                weather={weather}
                onCity={setCity}
                onCallName={setCallName}
                onAssistantName={setAssistantName}
                onChip={(phrase) => {
                  primeAudio();
                  void submit(phrase);
                }}
                onPhrase={(phrase) => {
                  primeAudio();
                  void submit(phrase);
                }}
                onGloss={(on) => {
                  primeAudio();
                  void submit(
                    language === "tr" ? (on ? "çeviriyi aç" : "çeviriyi kapat") : on ? "translation on" : "translation off",
                  );
                }}
                onFocus={setFocus}
                onVoice={setVoiceReplies}
                onLive={(on) => {
                  primeAudio();
                  void submit(language === "tr" ? (on ? "konuşma modu" : "konuşmayı kapat") : on ? "live talk" : "live off");
                }}
                onRemove={removeNote}
                onRemoveMemory={removeMemory}
                onRemoveReminder={removeReminder}
                onClear={() => {
                  setSystemsOpen(false);
                  primeAudio();
                  void submit(language === "tr" ? "Sohbeti temizle" : "Clear chat");
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {partial || status}
      </p>
      {hud === "flight" ? (
        <FlightHud
          c={c}
          listening={phase === "listening"}
          eye={eye}
          boot={cameraBoot}
          lookTick={lookTick}
          language={language}
          assistantName={aiName}
          chip={chip}
          onLand={closeHud}
          onMic={() => void onMic()}
          onEye={toggleFlightEye}
          onScan={() => openFlightEye(true)}
          onSeen={onSeen}
        />
      ) : null}
      {hud === "watch" ? (
        <WatchHud
          c={c}
          now={now}
          city={city}
          sky={weather ? `${weather.temp}° · ${weather.label}` : null}
          note={notes[0]?.text ?? null}
          listening={phase === "listening"}
          onClose={closeHud}
          onMic={() => void onMic()}
        />
      ) : null}
      {hud === "browser" ? (
        <BrowserHud
          c={c}
          listening={phase === "listening"}
          request={browseRequest}
          onRequestDone={() => setBrowseRequest(null)}
          onClose={closeHud}
          onMic={() => void onMic()}
        />
      ) : null}
      {hud === "armor" ? (
        <ArmorHud
          c={c}
          chip={chipLabel}
          city={city}
          listening={phase === "listening"}
          onClose={closeHud}
          onMic={() => void onMic()}
        />
      ) : null}
      {hud === "camera" ? (
        <CameraHud
          c={c}
          language={language}
          assistantName={aiName}
          chip={chip}
          boot={cameraBoot}
          lookTick={lookTick}
          onClose={closeHud}
          onSeen={onSeen}
        />
      ) : null}
    </div>
  );
}

function Workshop(props: {
  c: Copy;
  now: number | null;
  language: Lang;
  city: string;
  callName: string;
  assistantName: string;
  chip: Chip;
  notes: { id: string; text: string }[];
  focus: boolean;
  voiceReplies: boolean;
  voiceId: VoiceId;
  gloss: boolean;
  memories: { id: string; text: string }[];
  reminders: { id: string; text: string; at: number }[];
  liveTalk: boolean;
  weather: Weather | null;
  onCity: (value: string) => void;
  onCallName: (value: string) => void;
  onAssistantName: (value: string) => void;
  onChip: (phrase: string) => void;
  onPhrase: (phrase: string) => void;
  onGloss: (on: boolean) => void;
  onFocus: (value: boolean) => void;
  onVoice: (value: boolean) => void;
  onLive: (on: boolean) => void;
  onRemove: (id: string) => void;
  onRemoveMemory: (id: string) => void;
  onRemoveReminder: (id: string) => void;
  onClear: () => void;
}) {
  const { c } = props;
  return (
    <div className="flex flex-col gap-3">
      <section className="panel bg-card">
        <p className="font-mono text-xs tracking-widest text-faint uppercase">{c.weather}</p>
        <p className="mt-3 font-mono text-2xl tabular-nums text-foreground">{clock(props.now)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{dateLine(props.now, props.language)}</p>
        {props.focus ? null : (
          <p className="mt-3 text-sm text-foreground">
            {props.weather
              ? `${props.weather.temp}° · ${props.weather.label} · ${props.weather.wind} km/sa ${c.wind}`
              : props.c.unknownWeather}
          </p>
        )}
        <label className="mt-4 block font-mono text-xs tracking-widest text-faint uppercase" htmlFor="city">
          {c.city}
        </label>
        <input
          id="city"
          value={props.city}
          onChange={(event) => props.onCity(event.target.value)}
          className="inset mt-2 h-11 w-full border border-border bg-field px-3 text-sm text-foreground"
          maxLength={48}
        />
      </section>

      <section className="panel bg-card">
        <label className="font-mono text-xs tracking-widest text-faint uppercase" htmlFor="call">
          {c.call}
        </label>
        <p className="mt-1 text-sm text-muted-foreground">{c.callHint}</p>
        <input
          id="call"
          value={props.callName}
          onChange={(event) => props.onCallName(event.target.value)}
          className="inset mt-3 h-11 w-full border border-border bg-field px-3 text-sm text-foreground"
          maxLength={24}
        />
        <label className="mt-4 block font-mono text-xs tracking-widest text-faint uppercase" htmlFor="assistant">
          {c.assistant}
        </label>
        <p className="mt-1 text-sm text-muted-foreground">{c.assistantHint}</p>
        <input
          id="assistant"
          value={props.assistantName}
          onChange={(event) => props.onAssistantName(event.target.value)}
          placeholder="J.A.R.V.I.S."
          className="inset mt-3 h-11 w-full border border-border bg-field px-3 text-sm text-foreground"
          maxLength={24}
        />
      </section>

      <section className="panel bg-card">
        <p className="font-mono text-xs tracking-widest text-faint uppercase">{c.chips}</p>
        <p className="mt-1 text-sm text-muted-foreground">{c.chipHint}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ["aide", c.chipAide, props.language === "tr" ? "Atölye çipine geç" : "Switch to Jarvis"],
              ["edge", c.chipEdge, props.language === "tr" ? "Volt çipine geç" : "Switch to Volt"],
              ["field", c.chipField, props.language === "tr" ? "Mira çipine geç" : "Switch to Mira"],
            ] as const
          ).map(([id, label, phrase]) => (
            <button
              key={id}
              type="button"
              className={`inset h-11 border px-2 text-sm ${
                props.chip === id ? "border-accent text-foreground" : "border-border text-muted-foreground"
              }`}
              onClick={() => props.onChip(phrase)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel bg-card">
        <p className="font-mono text-xs tracking-widest text-faint uppercase">{c.voices}</p>
        <p className="mt-1 text-sm text-muted-foreground">{c.voiceHintPick}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {VOICES.map((id) => (
            <button
              key={id}
              type="button"
              className={`inset h-11 border text-sm capitalize ${
                props.voiceId === id ? "border-accent text-foreground" : "border-border text-muted-foreground"
              }`}
              onClick={() => props.onPhrase(props.language === "tr" ? `sesi ${id} yap` : `voice ${id}`)}
            >
              {id}
            </button>
          ))}
        </div>
      </section>

      <section className="panel flex flex-col gap-3 bg-card">
        <Toggle
          label={c.focus}
          hint={c.focusHint}
          checked={props.focus}
          onChange={props.onFocus}
        />
        <div className="h-px bg-border" />
        <Toggle
          label={c.voice}
          hint={c.voiceHint}
          checked={props.voiceReplies}
          onChange={props.onVoice}
          icon={props.voiceReplies ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        />
        <div className="h-px bg-border" />
        <Toggle
          label={c.gloss}
          hint={c.glossHint}
          checked={props.gloss}
          onChange={props.onGloss}
        />
        <div className="h-px bg-border" />
        <Toggle label={c.live} hint={c.liveHint} checked={props.liveTalk} onChange={props.onLive} />
      </section>

      <section className="panel bg-card">
        <p className="font-mono text-xs tracking-widest text-faint uppercase">{c.notes}</p>
        {props.notes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{c.emptyNotes}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {props.notes.map((note) => (
              <li key={note.id} className="flex items-start gap-2">
                <p className="flex-1 text-sm leading-normal text-foreground">{note.text}</p>
                <button
                  type="button"
                  className="inset inline-flex size-11 shrink-0 items-center justify-center border border-border text-muted-foreground"
                  onClick={() => props.onRemove(note.id)}
                  aria-label={c.deleteNote}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel bg-card">
        <p className="font-mono text-xs tracking-widest text-faint uppercase">{c.memory}</p>
        {props.memories.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{c.emptyMemory}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {props.memories.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <p className="flex-1 text-sm leading-normal text-foreground">{item.text}</p>
                <button
                  type="button"
                  className="inset inline-flex size-11 shrink-0 items-center justify-center border border-border text-muted-foreground"
                  onClick={() => props.onRemoveMemory(item.id)}
                  aria-label={c.deleteNote}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel bg-card">
        <p className="font-mono text-xs tracking-widest text-faint uppercase">{c.reminders}</p>
        {props.reminders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{c.emptyReminders}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {props.reminders.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <p className="flex-1 text-sm leading-normal text-foreground">
                  <span className="font-mono text-xs text-muted-foreground">{whenLabel(item.at, props.language)}</span>
                  <span className="mt-1 block">{item.text}</span>
                </p>
                <button
                  type="button"
                  className="inset inline-flex size-11 shrink-0 items-center justify-center border border-border text-muted-foreground"
                  onClick={() => props.onRemoveReminder(item.id)}
                  aria-label={c.deleteNote}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button
        type="button"
        className="inset h-11 border border-border text-sm text-foreground"
        onClick={props.onClear}
      >
        {c.clear}
      </button>
    </div>
  );
}

function Toggle(props: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      className="flex items-center gap-3 text-left"
      onClick={() => props.onChange(!props.checked)}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {props.icon}
          {props.label}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{props.hint}</span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border border-border ${
          props.checked ? "bg-primary" : "bg-field"
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full ${
            props.checked ? "right-0.5 bg-primary-foreground" : "left-0.5 bg-muted-foreground"
          }`}
        />
      </span>
    </button>
  );
}
