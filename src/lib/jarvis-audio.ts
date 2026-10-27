import type { Lang } from "@/lib/jarvis-protocol";

const SILENT =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

let shared: HTMLAudioElement | null = null;

function element(): HTMLAudioElement {
  if (!shared) shared = new Audio();
  return shared;
}

export function primeAudio(): void {
  const audio = element();
  if (!audio.src) audio.src = SILENT;
  const played = audio.play();
  if (played) {
    void played
      .then(() => {
        audio.pause();
      })
      .catch(() => undefined);
  }
}

export function stopAudio(): void {
  if (shared) {
    shared.pause();
    shared.removeAttribute("src");
    shared.load();
  }
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function playMp3(audioBase64: string): Promise<void> {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: "audio/mpeg" }));
  const audio = element();
  audio.src = url;
  return new Promise((resolve, reject) => {
    const done = () => {
      URL.revokeObjectURL(url);
      audio.onended = null;
      audio.onerror = null;
      resolve();
    };
    audio.onended = done;
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("audio"));
    };
    void audio.play().catch((error: unknown) => {
      URL.revokeObjectURL(url);
      reject(error instanceof Error ? error : new Error("audio"));
    });
  });
}

export function speakNative(text: string, language: Lang): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "tr" ? "tr-TR" : "en-GB";
    utterance.rate = 0.96;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) =>
      language === "tr" ? voice.lang.toLowerCase().startsWith("tr") : /en-GB/i.test(voice.lang),
    );
    if (preferred) utterance.voice = preferred;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}
