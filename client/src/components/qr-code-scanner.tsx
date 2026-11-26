import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Upload, X } from "lucide-react";
import jsQR from "jsqr";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
}

export function QRCodeScanner({ onScan, onError }: QRCodeScannerProps) {
  const [mode, setMode] = useState<"idle" | "camera" | "file">("idle");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number>();
  const session = useRef(0);
  const active = useRef(false);
  const callbacks = useRef({ onScan, onError });
  callbacks.current = { onScan, onError };
  const hasCamera = typeof navigator.mediaDevices?.getUserMedia === "function";

  function stop() {
    session.current++;
    active.current = false;
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  useEffect(() => {
    const release = () => stop();
    return release;
  }, []);

  function finish(attempt: number) {
    if (attempt !== session.current) return false;
    stop();
    setMode("idle");
    return true;
  }

  function reject(attempt: number, message: string) {
    if (!finish(attempt)) return;
    setError(message);
    callbacks.current.onError?.(new Error(message));
  }

  function decode(source: CanvasImageSource, width: number, height: number) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !context) return;
    const scale = Math.min(1, 1280 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    context.drawImage(source, 0, 0, w, h);
    const { data } = context.getImageData(0, 0, w, h);
    return jsQR(data, w, h, { inversionAttempts: "attemptBoth" })?.data;
  }

  async function startCamera() {
    if (active.current || !hasCamera) return;
    active.current = true;
    const attempt = ++session.current;
    setMode("camera");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      const video = videoRef.current;
      if (attempt !== session.current || !video) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (attempt !== session.current) return;
      timerRef.current = window.setInterval(() => {
        if (attempt !== session.current || video.readyState < video.HAVE_CURRENT_DATA ||
          !video.videoWidth || !video.videoHeight) return;
        let data: string | undefined;
        try {
          data = decode(video, video.videoWidth, video.videoHeight);
        } catch {
          reject(attempt, "Impossible de lire l’image de la caméra. Réessayez ou choisissez une photo.");
          return;
        }
        // Invalidate this attempt and release the camera before notifying the caller.
        if (data && finish(attempt)) callbacks.current.onScan(data);
      }, 200);
    } catch (error) {
      reject(attempt, error instanceof Error && error.name === "NotAllowedError"
        ? "Accès à la caméra refusé. Autorisez-la dans les réglages de l’appareil ou choisissez une photo."
        : "Impossible d’ouvrir la caméra. Réessayez ou choisissez une photo.");
    }
  }

  async function readPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || active.current) return;
    active.current = true;
    const attempt = ++session.current;
    setError("");
    setMode("file");
    const url = URL.createObjectURL(file);
    let data: string | undefined;
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = url;
      });
      if (attempt !== session.current) return;
      data = decode(image, image.naturalWidth, image.naturalHeight);
    } catch {
      reject(attempt, "Impossible de lire cette photo.");
      return;
    } finally {
      URL.revokeObjectURL(url);
    }
    if (!data) reject(attempt, "Aucun QR code détecté dans cette photo.");
    else if (finish(attempt)) callbacks.current.onScan(data);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-primary bg-black" hidden={mode !== "camera"}>
        <video ref={videoRef} muted autoPlay playsInline className="h-auto max-h-[55dvh] w-full object-contain" />
      </div>
      <canvas ref={canvasRef} hidden />
      {mode === "camera" ? <>
        <p className="text-center text-sm text-muted-foreground">Placez le QR code dans le cadre.</p>
        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => finish(session.current)}>
          <X aria-hidden /> Annuler le scan
        </Button>
      </> : <>
        {hasCamera ? (
          <Button type="button" variant="outline" className="min-h-11 w-full" disabled={mode !== "idle"} onClick={() => void startCamera()}>
            <Camera aria-hidden /> Démarrer la caméra
          </Button>
        ) : <p className="text-center text-sm text-muted-foreground">Caméra indisponible. Vérifiez que l’application est ouverte en HTTPS.</p>}
        <Input ref={fileRef} type="file" accept="image/*" onChange={readPhoto} hidden />
        <Button type="button" variant="outline" className="min-h-11 w-full" disabled={mode !== "idle"} onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden /> Choisir une photo du QR code
        </Button>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
