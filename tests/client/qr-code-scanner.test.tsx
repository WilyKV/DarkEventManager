import { act, fireEvent, render, screen } from "@testing-library/react";
import QRCode from "qrcode";
import { afterEach, expect, it, vi } from "vitest";
import { QRCodeScanner } from "@/components/qr-code-scanner";

const payload = "https://example.com/souvenir/AAAAAAAAAAAAAAAAAAAAAAAAAAA";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "mediaDevices");
});

it.each([false, true])("lit un QR sans BarcodeDetector et n’émet qu’un résultat (inversé = %s)", async inverted => {
  vi.useFakeTimers();
  vi.stubGlobal("BarcodeDetector", undefined);
  const modules = QRCode.create(payload, { errorCorrectionLevel: "M" }).modules;
  const dimension = (modules.size + 8) * 6;
  const pixels = new Uint8ClampedArray(dimension * dimension * 4);
  for (let y = 0; y < dimension; y++) {
    for (let x = 0; x < dimension; x++) {
      const row = Math.floor(y / 6) - 4;
      const column = Math.floor(x / 6) - 4;
      const dark = row >= 0 && column >= 0 && row < modules.size && column < modules.size && Boolean(modules.get(row, column));
      const color = dark !== inverted ? 0 : 255;
      const offset = 4 * (y * dimension + x);
      pixels.set([color, color, color, 255], offset);
    }
  }
  const stop = vi.fn();
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(), getImageData: () => ({ data: pixels }),
  } as unknown as CanvasRenderingContext2D);
  const onScan = vi.fn(() => expect(stop).toHaveBeenCalledOnce());
  const { container, unmount } = render(<QRCodeScanner onScan={onScan} />);
  const video = container.querySelector("video")!;
  Object.defineProperties(video, {
    videoWidth: { value: dimension },
    videoHeight: { value: dimension },
    readyState: { value: video.HAVE_CURRENT_DATA },
  });

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Démarrer la caméra" })));
  expect(video.playsInline).toBe(true);
  expect(video.muted).toBe(true);
  expect(getUserMedia).toHaveBeenCalledOnce();
  await act(async () => vi.advanceTimersByTime(1000));
  expect(onScan).toHaveBeenCalledExactlyOnceWith(payload);
  expect(video.srcObject).toBeNull();
  unmount();
  expect(stop).toHaveBeenCalledOnce();
});

it("libère une caméra autorisée après la fermeture du scanner", async () => {
  const stop = vi.fn();
  let grantCamera!: (stream: { getTracks: () => { stop: typeof stop }[] }) => void;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: () => new Promise(resolve => { grantCamera = resolve; }) },
  });
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const onScan = vi.fn();
  const { unmount } = render(<QRCodeScanner onScan={onScan} />);
  fireEvent.click(screen.getByRole("button", { name: "Démarrer la caméra" }));
  unmount();
  await act(async () => grantCamera({ getTracks: () => [{ stop }] }));
  expect(stop).toHaveBeenCalledOnce();
  expect(play).not.toHaveBeenCalled();
  expect(onScan).not.toHaveBeenCalled();
});
