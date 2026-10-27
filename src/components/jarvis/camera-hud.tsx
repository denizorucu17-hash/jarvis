import { useEffect, useRef, useState } from "react";
import { ArcMark } from "@/components/jarvis/arc-mark";
import { lookJarvis } from "@/lib/jarvis.functions";
import type { Copy } from "@/lib/jarvis-copy";
import type { Chip, Lang } from "@/lib/jarvis-protocol";

type Facing = "environment" | "user";

export function armCamera(facing: Facing = "environment"): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing } },
    audio: false,
  });
}

export function CameraHud(props: {
  c: Copy;
  language: Lang;
  assistantName: string;
  chip: Chip;
  boot: Promise<MediaStream> | null;
  lookTick: number;
  onClose: () => void;
  onSeen: (text: string) => void;
}) {
  const { c } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const live = useRef<MediaStream | null>(null);
  const lastLook = useRef(0);
  const [denied, setDenied] = useState(false);
  const [ready, setReady] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookFail, setLookFail] = useState(false);
  const [facing, setFacing] = useState<Facing>("environment");

  useEffect(() => {
    return () => {
      live.current?.getTracks().forEach((track) => track.stop());
      live.current = null;
    };
  }, []);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !live.current) return;
    node.srcObject = live.current;
    void node.play().catch(() => undefined);
  }, [ready]);

  function adopt(stream: MediaStream) {
    live.current?.getTracks().forEach((track) => track.stop());
    live.current = stream;
    setDenied(false);
    setReady(true);
    const node = videoRef.current;
    if (node) {
      node.srcObject = stream;
      void node.play().catch(() => undefined);
    }
  }

  useEffect(() => {
    if (!props.boot) return;
    let dead = false;
    void props.boot
      .then((stream) => {
        if (dead) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        adopt(stream);
      })
      .catch(() => {
        if (!dead) {
          setDenied(true);
          props.onSeen(props.c.camDenied);
        }
      });
    return () => {
      dead = true;
    };
    // boot identity is the gesture-started promise
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.boot]);

  async function connect(next: Facing) {
    setFacing(next);
    setDenied(false);
    try {
      adopt(await armCamera(next));
    } catch {
      setDenied(true);
      setReady(false);
    }
  }

  async function look() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2 || looking) return;
    setLooking(true);
    setLookFail(false);
    const canvas = document.createElement("canvas");
    const width = 640;
    const height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width));
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setLooking(false);
      setLookFail(true);
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
      else setLookFail(true);
    } catch {
      setLookFail(true);
    } finally {
      setLooking(false);
    }
  }

  useEffect(() => {
    if (!ready || props.lookTick === 0 || props.lookTick === lastLook.current) return;
    const video = videoRef.current;
    if (!video) return;
    const run = () => {
      if (props.lookTick === lastLook.current) return;
      lastLook.current = props.lookTick;
      void look();
    };
    if (video.readyState >= 2 && video.videoWidth > 0) run();
    else video.addEventListener("loadeddata", run, { once: true });
    // look is recreated each render; the tick guard prevents a loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.lookTick]);

  return (
    <div className="fixed inset-0 z-40 bg-background text-foreground">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline autoPlay muted />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ArcMark className="size-36 text-accent opacity-80" />
      </div>
      <header className="safe-top relative flex items-center justify-between px-5">
        <p className="wordmark text-sm">{c.camera}</p>
        <p className="font-mono text-xs text-muted-foreground">{looking ? c.looking : c.scan}</p>
      </header>
      {denied ? (
        <p className="relative mx-5 mt-6 max-w-sm text-sm text-foreground" role="alert">
          {c.camDenied}
        </p>
      ) : null}
      {lookFail ? <p className="relative mx-5 mt-3 text-sm text-muted-foreground">{c.lookFail}</p> : null}
      <div className="safe-bottom absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 px-4">
        <button
          type="button"
          className="inset h-11 border border-border bg-card px-4 text-sm"
          onClick={() => void connect(facing === "environment" ? "user" : "environment")}
        >
          {denied || !ready ? c.connectCam : c.flip}
        </button>
        <button
          type="button"
          className="inset h-11 border border-border bg-card px-4 text-sm disabled:opacity-40"
          onClick={() => {
            lastLook.current = 0;
            void look();
          }}
          disabled={!ready || looking}
        >
          {c.scan}
        </button>
        <button type="button" className="inset h-11 bg-primary px-4 text-sm text-primary-foreground" onClick={props.onClose}>
          {c.closeCam}
        </button>
      </div>
    </div>
  );
}
