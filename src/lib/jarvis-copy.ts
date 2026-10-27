import type { Chip, Lang } from "@/lib/jarvis-protocol";

export const copy = {
  tr: {
    online: "Çevrimiçi",
    you: "Siz",
    kicker: "Kişisel sistemler",
    greeting: "Sistemler çevrimiçi.",
    hint: "Yazın, mikrofona dokunun, ya da bir mod söyleyin.",
    placeholder: "Bir şey sorun",
    listening: "Dinliyorum",
    transcribing: "Çözümlüyorum",
    thinking: "İşleniyor",
    speaking: "Konuşuyor",
    send: "Gönder",
    mic: "Sesle sor",
    stop: "Kaydı bitir",
    voice: "Sesli yanıt",
    voiceHint: "Kısa cümleler, sakin bir ses.",
    systems: "Sistem",
    close: "Kapat",
    focus: "Odak",
    focusHint: "Öneriler ve hava gizlenir.",
    call: "Hitap",
    callHint: "Boşsa “efendim” der.",
    assistant: "Asistanın adı",
    assistantHint: "Atölye çipinin adı. Jarvis seste Carvis diye okunur.",
    chips: "Çip",
    chipHint: "Sakin, keskin ya da saha. “Çipi değiştir” de.",
    chipAide: "Atölye",
    chipEdge: "Volt",
    chipField: "Mira",
    city: "Şehir",
    notes: "Notlar",
    emptyNotes: "Henüz not yok.",
    clear: "Sohbeti temizle",
    weather: "Hava",
    wind: "rüzgâr",
    unknownWeather: "Ölçüm yok",
    deleteNote: "Notu sil",
    suggestions: ["Uçuşu başlat", "Tarayıcı", "Dolar", "Haberler", "8 dakika say", "Konuşma modu", "Nöbet", "Brifing"],
    micDenied: "Mikrofon kapalı. Yazılı devam edebilirsiniz.",
    hearFail: "Sizi net duyamadım. Bir kez daha dener misiniz?",
    aiDown: "Şu an yanıt üretemiyorum. Biraz sonra tekrar deneyin.",
    unavailable: "Yapay zekâ bu ortamda kullanılamıyor.",
    replay: "Seslendir",
    lang: "Dili değiştir",
    flight: "Uçuş",
    land: "İniş",
    alt: "İRT m",
    spd: "km/sa",
    hdg: "YÖN",
    gpsOn: "GPS",
    gpsOff: "Konum kapalı",
    camera: "Kamera",
    scan: "Tara",
    closeCam: "Kapat",
    flip: "Çevir",
    connectCam: "Kamerayı bağla",
    camDenied: "Kameraya erişilemedi. İzin verip tekrar deneyin.",
    looking: "Bakıyorum",
    lookFail: "Görüntüyü okuyamadım.",
    armor: "Zırh",
    core: "Çekirdek",
    seal: "Mühür",
    nominal: "Nominal",
    sealed: "Kapalı",
    stow: "İndir",
    watch: "Nöbet",
    voices: "Ses",
    voiceHintPick: "Çip değişince ses de değişir. “Sesi değiştir” de.",
    quiet: "Sessiz",
    gloss: "Çeviri",
    glossHint: "Yanıta diğer dilde bir cümle ekler.",
    flightCam: "Uçuş kamerası",
    scanEye: "Tara",
    memory: "Hafıza",
    emptyMemory: "Kalıcı kayıt yok. “Hafızana yaz” de.",
    reminders: "Anımsatıcı",
    emptyReminders: "Kurulu anımsatıcı yok.",
    live: "Konuşma",
    liveHint: "Cevaptan sonra yine dinler.",
    timerStop: "Durdur",
    photo: "Fotoğraf",
    openMap: "Haritayı aç",
    whatsapp: "WhatsApp",
    sms: "Mesaj",
    dismiss: "Vazgeç",
    draftReady: "Taslak, henüz gönderilmedi",
    browser: "Tarayıcı",
    back: "Geri",
    forward: "İleri",
    reload: "Yenile",
    reader: "Okuyucu",
    livePage: "Canlı",
    openOut: "Dışarıda aç",
    go: "Git",
    browserHint: "Adres yaz, ya da “site aç” de.",
    browserEmpty: "Bir adres yaz.",
    pageFail: "Sayfa okunamadı.",
    opening: "Açılıyor",
  },
  en: {
    online: "Online",
    you: "You",
    kicker: "Personal systems",
    greeting: "Systems online.",
    hint: "Type, use the mic, or name a mode.",
    placeholder: "Ask anything",
    listening: "Listening",
    transcribing: "Transcribing",
    thinking: "Working",
    speaking: "Speaking",
    send: "Send",
    mic: "Ask aloud",
    stop: "Finish recording",
    voice: "Spoken replies",
    voiceHint: "Short lines, a calm voice.",
    systems: "Systems",
    close: "Close",
    focus: "Focus",
    focusHint: "Hides suggestions and weather.",
    call: "Address",
    callHint: "Leave blank and I will say “sir”.",
    assistant: "Your AI’s name",
    assistantHint: "Name of the workshop chip. Jarvis is spoken Carvis.",
    chips: "Chip",
    chipHint: "Calm, sharp, or field. Say “change chip”.",
    chipAide: "Workshop",
    chipEdge: "Volt",
    chipField: "Mira",
    city: "City",
    notes: "Notes",
    emptyNotes: "No notes yet.",
    clear: "Clear chat",
    weather: "Weather",
    wind: "wind",
    unknownWeather: "No reading",
    deleteNote: "Delete note",
    suggestions: ["Start flight", "Browser", "Dollar", "Headlines", "8 minute timer", "Live talk", "Watch", "Briefing"],
    micDenied: "Microphone is off. You can keep typing.",
    hearFail: "I didn't catch that. Try once more?",
    aiDown: "I can't answer just now. Try again in a moment.",
    unavailable: "AI is unavailable in this environment.",
    replay: "Play voice",
    lang: "Change language",
    flight: "Flight",
    land: "Land",
    alt: "ALT m",
    spd: "km/h",
    hdg: "HDG",
    gpsOn: "GPS",
    gpsOff: "Location off",
    camera: "Camera",
    scan: "Scan",
    closeCam: "Close",
    flip: "Flip",
    connectCam: "Connect camera",
    camDenied: "Camera is unavailable. Allow it and try again.",
    looking: "Looking",
    lookFail: "I couldn't read that frame.",
    armor: "Armor",
    core: "Core",
    seal: "Seal",
    nominal: "Nominal",
    sealed: "Sealed",
    stow: "Stow",
    watch: "Watch",
    voices: "Voice",
    voiceHintPick: "Changing chip also changes the voice. Say “change voice”.",
    quiet: "Quiet",
    gloss: "Translate",
    glossHint: "Adds one sentence in the other language.",
    flightCam: "Flight camera",
    scanEye: "Scan",
    memory: "Memory",
    emptyMemory: "Nothing kept yet. Say “remember that”.",
    reminders: "Reminders",
    emptyReminders: "No reminders set.",
    live: "Live talk",
    liveHint: "Listens again after each reply.",
    timerStop: "Stop",
    photo: "Photo",
    openMap: "Open map",
    whatsapp: "WhatsApp",
    sms: "Message",
    dismiss: "Dismiss",
    draftReady: "Draft, not sent",
    browser: "Browser",
    back: "Back",
    forward: "Forward",
    reload: "Reload",
    reader: "Reader",
    livePage: "Live",
    openOut: "Open out",
    go: "Go",
    browserHint: "Type an address, or say “open site”.",
    browserEmpty: "Type an address.",
    pageFail: "Couldn’t read that page.",
    opening: "Opening",
  },
} as const;

export type Copy = (typeof copy)[Lang];

export function clearedLine(language: Lang, callName: string): string {
  if (language === "tr") {
    return `Sohbet temizlendi. ${callName || "Efendim"}, emrinizdeyim.`;
  }
  return `Chat cleared. At your service, ${callName || "sir"}.`;
}

export function modeLine(
  mode: "flight" | "camera" | "scan" | "armor" | "watch" | "browser" | "off",
  language: Lang,
  callName: string,
): string {
  const who = callName || (language === "tr" ? "Efendim" : "sir");
  if (language === "tr") {
    if (mode === "flight") return `Uçuş modu açık, ${who}. Telemetri ekranda.`;
    if (mode === "camera") return `Kameraya bağlanıyorum, ${who}.`;
    if (mode === "scan") return `Tarama başlıyor, ${who}.`;
    if (mode === "armor") return `Zırh tanı açık, ${who}. Atölye mühürü kapalı.`;
    if (mode === "watch") return `Nöbet başladı, ${who}. Saat ve hava ekranda.`;
    if (mode === "browser") return `Tarayıcı açık, ${who}. Adresi yaz.`;
    return `Mod kapatıldı, ${who}.`;
  }
  if (mode === "flight") return `Flight mode engaged, ${who}. Telemetry is on screen.`;
  if (mode === "camera") return `Connecting the camera, ${who}.`;
  if (mode === "scan") return `Scan underway, ${who}.`;
  if (mode === "armor") return `Armor diagnostic is up, ${who}. The workshop seal is closed.`;
  if (mode === "watch") return `Watch started, ${who}. Clock and weather are on screen.`;
  if (mode === "browser") return `Browser is open, ${who}. Type an address.`;
  return `Mode closed, ${who}.`;
}

export function briefingLine(input: {
  language: Lang;
  callName: string;
  city: string;
  temp: number | null;
  sky: string | null;
  notes: number;
  chip: string;
  now: number | null;
}): string {
  const who = input.callName || (input.language === "tr" ? "Efendim" : "sir");
  const clock =
    input.now === null
      ? "—"
      : new Intl.DateTimeFormat(input.language === "tr" ? "tr-TR" : "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(input.now);
  if (input.language === "tr") {
    const sky =
      input.temp === null ? "Hava ölçümü yok." : `${input.city || "Şehir"} ${input.temp} derece, ${input.sky}.`;
    const notes = input.notes === 0 ? "Kayıtlı not yok." : `${input.notes} not kayıtlı.`;
    return `Brifing, ${who}. Saat ${clock}. ${sky} ${notes} Çip: ${input.chip}.`;
  }
  const sky =
    input.temp === null ? "No weather reading." : `${input.city || "City"} ${input.temp} degrees, ${input.sky}.`;
  const notes = input.notes === 0 ? "No notes on file." : `${input.notes} notes on file.`;
  return `Briefing, ${who}. ${clock}. ${sky} ${notes} Chip: ${input.chip}.`;
}

export function chipLine(chip: Chip, language: Lang, callName: string, assistantName: string): string {
  const who = callName || (language === "tr" ? "Efendim" : "sir");
  const aide = assistantName.trim() || "J.A.R.V.I.S.";
  if (language === "tr") {
    if (chip === "edge") return `Keskin çip devrede, ${who}. Volt hazır.`;
    if (chip === "field") return `Saha çipi devrede, ${who}. Mira hazır.`;
    return `Atölye çipi devrede, ${who}. ${aide} hazır.`;
  }
  if (chip === "edge") return `Sharp chip online, ${who}. Volt is ready.`;
  if (chip === "field") return `Field chip online, ${who}. Mira is ready.`;
  return `Workshop chip online, ${who}. ${aide} is ready.`;
}

export function voiceLine(voice: string, language: Lang, callName: string): string {
  const who = callName || (language === "tr" ? "Efendim" : "sir");
  const name = voice.slice(0, 1).toUpperCase() + voice.slice(1);
  return language === "tr" ? `Ses ${name}, ${who}.` : `Voice set to ${name}, ${who}.`;
}

export function quietLine(on: boolean, language: Lang, callName: string): string {
  const who = callName || (language === "tr" ? "Efendim" : "sir");
  if (language === "tr") return on ? `Sessiz mod, ${who}.` : `Ses açıldı, ${who}.`;
  return on ? `Quiet mode, ${who}.` : `Voice is back, ${who}.`;
}

export function glossLine(on: boolean, language: Lang, callName: string): string {
  const who = callName || (language === "tr" ? "Efendim" : "sir");
  if (language === "tr") return on ? `Çeviri açık, ${who}.` : `Çeviri kapandı, ${who}.`;
  return on ? `Translation is on, ${who}.` : `Translation is off, ${who}.`;
}

export function eyeLine(on: boolean, language: Lang, callName: string): string {
  const who = callName || (language === "tr" ? "Efendim" : "sir");
  if (language === "tr") return on ? `Uçuş kamerası açık, ${who}.` : `Uçuş kamerası kapandı, ${who}.`;
  return on ? `Flight camera is open, ${who}.` : `Flight camera is closed, ${who}.`;
}
