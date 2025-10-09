import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Camera, X, Upload } from 'lucide-react';
import { Input } from './ui/input';
import jsQR from 'jsqr';

interface QRCodeScannerProps {
  onScan: (data: string) => void;
  onError?: (error: Error) => void;
}

export function QRCodeScanner({ onScan, onError }: QRCodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if camera is available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setHasCamera(true);
    } else {
      setHasCamera(false);
    }
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setScanning(true);

        // Start scanning for QR codes (if BarcodeDetector is available)
        if ('BarcodeDetector' in window) {
          scanIntervalRef.current = window.setInterval(() => {
            scanQRCode();
          }, 500);
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      if (onError) {
        onError(error as Error);
      }
      setHasCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
  };

  const scanQRCode = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Use jsQR library (works on all browsers)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code) {
        onScan(code.data);
        stopCamera();
      }
    } catch (error) {
      console.log('QR detection error:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);

        try {
          // Use jsQR library (works on all browsers)
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
            onScan(code.data);
          } else {
            if (onError) {
              onError(new Error('Aucun QR Code détecté dans l\'image'));
            }
          }
        } catch (error) {
          if (onError) {
            onError(error as Error);
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-4">
      {scanning ? (
        <div className="relative">
          <div className="border-2 border-primary rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto"
            />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <Button
            variant="destructive"
            className="mt-4 w-full gap-2"
            onClick={stopCamera}
          >
            <X className="w-4 h-4" />
            Annuler le scan
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Positionnez le QR Code dans le cadre
          </p>
          {!('BarcodeDetector' in window) && (
            <p className="text-xs text-amber-600 text-center mt-1">
              ⚠️ Détection automatique non disponible. Utilisez l'upload d'image.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {hasCamera ? (
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={startCamera}
            >
              <Camera className="w-4 h-4" />
              {('BarcodeDetector' in window)
                ? 'Démarrer la caméra'
                : 'Démarrer la caméra (prévisualisation uniquement)'}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              Caméra non disponible sur cet appareil
            </p>
          )}

          <div className="relative">
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id="qr-file-upload"
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => document.getElementById('qr-file-upload')?.click()}
            >
              <Upload className="w-4 h-4" />
              Uploader une image QR Code
            </Button>
          </div>

          {!('BarcodeDetector' in window) && (
            <p className="text-xs text-muted-foreground text-center">
              Pour une meilleure expérience, utilisez Chrome ou Edge
            </p>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
}
