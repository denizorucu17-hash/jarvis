import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Chip, Ctrl, Lang, VoiceId } from "@/lib/jarvis-protocol";
import { VOICES, chipVoice } from "@/lib/jarvis-protocol";

export type Note = { id: string; text: string; at: number };
export type Memory = { id: string; text: string };
export type Reminder = { id: string; text: string; at: number };
export type Msg = { id: string; role: "user" | "jarvis"; text: string };
export type Hud = "off" | "flight" | "camera" | "armor" | "watch" | "browser";

type Workshop = {
  language: Lang;
  callName: string;
  assistantName: string;
  city: string;
  notes: Note[];
  focus: boolean;
  voiceReplies: boolean;
  messages: Msg[];
  hud: Hud;
  chip: Chip;
  voiceId: VoiceId;
  gloss: boolean;
  eye: boolean;
  lookTick: number;
  memories: Memory[];
  reminders: Reminder[];
  liveTalk: boolean;
  timerUntil: number | null;
  setLanguage: (language: Lang) => void;
  setCallName: (callName: string) => void;
  setAssistantName: (assistantName: string) => void;
  setCity: (city: string) => void;
  setFocus: (focus: boolean) => void;
  setVoiceReplies: (voiceReplies: boolean) => void;
  push: (message: Msg) => void;
  replaceMessages: (messages: Msg[]) => void;
  removeNote: (id: string) => void;
  addMemory: (text: string) => void;
  removeMemory: (id: string) => void;
  addReminder: (text: string, at: number) => void;
  removeReminder: (id: string) => void;
  setLiveTalk: (on: boolean) => void;
  setTimerUntil: (at: number | null) => void;
  applyCtrl: (ctrl: Ctrl) => void;
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useJarvis = create<Workshop>()(
  persist(
    (set) => ({
      language: "tr",
      callName: "",
      assistantName: "J.A.R.V.I.S.",
      city: "İstanbul",
      notes: [],
      focus: false,
      voiceReplies: true,
      messages: [],
      hud: "off",
      chip: "aide",
      voiceId: "leo",
      gloss: false,
      eye: false,
      lookTick: 0,
      memories: [],
      reminders: [],
      liveTalk: false,
      timerUntil: null,
      setLanguage: (language) => set({ language }),
      setCallName: (callName) => set({ callName: callName.slice(0, 24) }),
      setAssistantName: (assistantName) => set({ assistantName: assistantName.slice(0, 24) }),
      setCity: (city) => set({ city: city.slice(0, 48) }),
      setFocus: (focus) => set({ focus }),
      setVoiceReplies: (voiceReplies) => set({ voiceReplies }),
      push: (message) => set((state) => ({ messages: [...state.messages, message].slice(-40) })),
      replaceMessages: (messages) => set({ messages }),
      removeNote: (id) => set((state) => ({ notes: state.notes.filter((note) => note.id !== id) })),
      addMemory: (text) =>
        set((state) => ({
          memories: [{ id: uid(), text: text.slice(0, 160) }, ...state.memories].slice(0, 16),
        })),
      removeMemory: (id) => set((state) => ({ memories: state.memories.filter((item) => item.id !== id) })),
      addReminder: (text, at) =>
        set((state) => ({
          reminders: [...state.reminders, { id: uid(), text: text.slice(0, 140), at }].slice(-12),
        })),
      removeReminder: (id) =>
        set((state) => ({ reminders: state.reminders.filter((item) => item.id !== id) })),
      setLiveTalk: (liveTalk) => set({ liveTalk }),
      setTimerUntil: (timerUntil) => set({ timerUntil }),
      applyCtrl: (ctrl) =>
        set((state) => {
          if (ctrl.op === "note") {
            const notes = [
              { id: uid(), text: ctrl.text, at: Date.now() },
              ...state.notes,
            ].slice(0, 12);
            return { notes };
          }
          if (ctrl.op === "drop") return { notes: state.notes.filter((note) => note.id !== ctrl.id) };
          if (ctrl.op === "rename") return { callName: ctrl.name };
          if (ctrl.op === "city") return { city: ctrl.name };
          if (ctrl.op === "focus") return { focus: ctrl.on };
          if (ctrl.op === "clear") return { messages: [] };
          if (ctrl.op === "mode") {
            if (ctrl.mode === "off") return { hud: "off" as const, eye: false };
            if (ctrl.mode === "flight") return { hud: "flight" as const };
            if (ctrl.mode === "armor") return { hud: "armor" as const, eye: false };
            if (ctrl.mode === "watch") return { hud: "watch" as const, eye: false };
            if (ctrl.mode === "browser") return { hud: "browser" as const, eye: false };
            return { hud: "camera" as const, eye: false, lookTick: state.lookTick + 1 };
          }
          if (ctrl.op === "eye") {
            return { eye: ctrl.on, lookTick: ctrl.scan ? state.lookTick + 1 : state.lookTick };
          }
          if (ctrl.op === "mute") return { voiceReplies: !ctrl.on };
          if (ctrl.op === "gloss") return { gloss: ctrl.on };
          if (ctrl.op === "voice") {
            if (ctrl.id === "next") {
              const index = VOICES.indexOf(state.voiceId);
              return { voiceId: VOICES[(index + 1) % VOICES.length] };
            }
            return { voiceId: ctrl.id };
          }
          if (ctrl.op === "chip") {
            const order: Chip[] = ["aide", "edge", "field"];
            const chip = ctrl.chip === "next" ? order[(order.indexOf(state.chip) + 1) % order.length] : ctrl.chip;
            return { chip, voiceId: chipVoice(chip) };
          }
          return {};
        }),
    }),
    {
      name: "jarvis-workshop",
      partialize: (state) => ({
        language: state.language,
        callName: state.callName,
        assistantName: state.assistantName,
        city: state.city,
        notes: state.notes,
        focus: state.focus,
        voiceReplies: state.voiceReplies,
        messages: state.messages,
        chip: state.chip,
        voiceId: state.voiceId,
        gloss: state.gloss,
        memories: state.memories,
        reminders: state.reminders,
        liveTalk: state.liveTalk,
        timerUntil: state.timerUntil,
      }),
    },
  ),
);

export function nextId(): string {
  return uid();
}
