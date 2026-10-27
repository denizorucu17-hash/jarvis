import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { ArcMark } from "@/components/jarvis/arc-mark";
import { armCamera } from "@/components/jarvis/camera-hud";
import { lookJarvis } from "@/lib/jarvis.functions";
import type { Copy } from "@/lib/jarvis-copy";
import type { Chip, Lang } from "@/lib/jarvis-protocol";

type Orientation = DeviceOrientationEvent & { webkitCompassHeading?: number };

export function claimFlight() {
  const orientation = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof orientation.requestPermission === "function") {
    void orientation.requestPermission().catch(() => undefined);
  }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      () => undefined,
      () => undefined,
      { enableHighAccuracy: true },
    );
  }
}

function reading(value: number | null, digits = 0): string {
  if (value === null || Number.isNaN(value) || value < 0) return "—";
  return Math.round(value).toString().padStart(digits, "0");
}

export function FlightHud(props: {
  c: Copy;
  listening: boolean;
  eye: boolean;
  boot: Promise<MediaStream> | null;
  lookTick: number;
  language: Lang;
  assistantName: string;
  chip: Chip;
  onLand: () => void;
  onMic: () => void;
  onEye: () => void;
  onScan: () => void;
  onSeen: (text: string) => void;
}) {
  const { c } = props;
  const [alt, setAlt] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [compass, setCompass] = useState<number | null>(null);
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [gps, setGps] = useState(false);

  useEffect(() => {
    let watch = 0;
    if (navigator.geolocation) {
      watch = navigator.geolocation.watchPosition(
        (pos) => {
          setGps(true);
          setAlt(pos.coords.altitude);
          setSpeed(pos.coords.speed);
          if (pos.coords.heading !== null && pos.coords.heading >= 0) setHeading(pos.coords.heading);
        },
        () => setGps(false),
        { enableHighAccuracy: true, maximumAge: 1000 },
      );
    }
    const onOrient = (event: Event) => {
      const row = event as Orientation;
      setPitch(row.beta ?? 0);
      setRoll(row.gamma ?? 0);
      if (typeof row.webkitCompassHeading === "number") setCompass(row.webkitCompassHeading);
      else if (row.alpha !== null) setCompass(Math.round(360 - row.alpha) % 360);
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      if (watch) navigator.geolocation.clearWatch(watch);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, []);

  const shift = Math.max(-36, Math.min(36, pitch)) * 2;
  const tilt = Math.max(-28, Math.min(28, roll));
  const hdg = heading ?? compass;
  const spd = speed === null || speed < 0 ? null : speed * 3.6;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-[-30%] flex items-center justify-center"
        style={{ transform: `translateY(${shift}px) rotate(${tilt}deg)` }}
      >
        <div className="relative h-[160%] w-[160%]">
          <div className="absolute inset-x-0 top-0 h-1/2 bg-field" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-background" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-accent" />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-4">
        <span className="absolute top-0 left-0 size-8 border-t border-l border-accent" />
        <span className="absolute top-0 right-0 size-8 border-t border-r border-accent" />
        <span className="absolute bottom-0 left-0 size-8 border-b border-l border-accent" />
        <span className="absolute right-0 bottom-0 size-8 border-r border-b border-accent" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ArcMark className="size-28 text-accent" />
      </div>
      <header className="safe-top relative flex items-center justify-between px-5">
        <p className="wordmark text-sm">{c.flight}</p>
        <button type="button" className="font-mono text-xs text-muted-foreground" onClick={claimFlight}>
          {gps ? c.gpsOn : c.gpsOff}
        </button>
      </header>
      <dl className="relative mt-6 grid grid-cols-3 px-5 font-mono text-sm tabular-nums">
        <div>
          <dt className="text-xs text-faint">{c.alt}</dt>
          <dd className="text-lg">{reading(alt)}</dd>
        </div>
        <div className="text-center">
          <dt className="text-xs text-faint">{c.spd}</dt>
          <dd className="text-lg">{reading(spd)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-faint">{c.hdg}</dt>
          <dd className="text-lg">{reading(hdg, 3)}</dd>
        </div>
      </dl>
      <div className="safe-bottom absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 px-5">
        <button
          type="button"
          className="inset h-11 border border-border bg-card px-5 text-sm"
          onClick={props.onLand}
        >
          {c.land}
        </button>
        <button
          type="button"
          className={`inset h-11 border bg-card px-4 text-sm ${
            props.eye ? "border-accent text-foreground" : "border-border"
          }`}
          onClick={props.onEye}
        >
          {c.camera}
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
      {props.eye ? (
        <FlightEye
          c={c}
          boot={props.boot}
          lookTick={props.lookTick}
          language={props.language}
          assistantName={props.assistantName}
          chip={props.chip}
          onScan={props.onScan}
          onSeen={props.onSeen}
        />
      ) : null}
    </div>
  );
}

function FlightEye(props: {
  c: Copy;
  boot: Promise<MediaStream> | null;
  lookTick: number;
  language: Lang;
  assistantName: string;
  chip: Chip;
  onScan: () => void;
  onSeen: (text: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const live = useRef<MediaStream | null>(null);
  const [denied, setDenied] = useState(false);
  const [ready, setReady] = useState(false);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    return () => {
      live.current?.getTracks().forEach((track) => track.stop());
      live.current = null;
    };
  }, []);

  useEffect(() => {
    if (!props.boot) return;
    let dead = false;
    void props.boot
      .then((stream) => {
        if (dead) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        live.current?.getTracks().forEach((track) => track.stop());
        live.current = stream;
        setDenied(false);
        setReady(true);
        const node = videoRef.current;
        if (node) {
          node.srcObject = stream;
          void node.play().catch(() => undefined);
        }
      })
      .catch(() => {
        if (!dead) setDenied(true);
      });
    return () => {
      dead = true;
    };
  }, [props.boot]);

  useEffect(() => {
    if (!ready || props.lookTick < 1) return;
    void look();
    // lookTick is the scan trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.lookTick, ready]);

  async function look() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2 || looking) return;
    setLooking(true);
    const canvas = document.createElement("canvas");
    const width = 640;
    const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setLooking(false);
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.72).split(",")[1] ?? "";
    try {
      const result = await lookJarvis({
        data: {
          imageBase64,
          language: props.language,
          assistantName: props.assistantName,
          chip: props.chip,
        },
      });
      if (result.ok) props.onSeen(result.text);
    } catch {
      /* vision can fail quietly during flight */
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="relative z-10 mt-4 mr-5 ml-auto w-28">
      <div className="relative aspect-[3/4] overflow-hidden border border-accent bg-field">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {denied ? (
          <button
            type="button"
            className="absolute inset-0 px-2 text-center font-mono text-xs text-foreground"
            onClick={() => {
              void armCamera()
                .then((stream) => {
                  live.current?.getTracks().forEach((track) => track.stop());
                  live.current = stream;
                  setDenied(false);
                  setReady(true);
                  const node = videoRef.current;
                  if (node) {
                    node.srcObject = stream;
                    void node.play().catch(() => undefined);
                  }
                })
                .catch(() => setDenied(true));
            }}
          >
            {props.c.connectCam}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="inset mt-2 h-11 w-full border border-border bg-card text-sm"
        onClick={props.onScan}
      >
        {looking ? props.c.looking : props.c.scanEye}
      </button>
    </div>
  );
}
