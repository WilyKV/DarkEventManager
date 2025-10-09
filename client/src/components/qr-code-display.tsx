import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  data: string;
  size?: number;
}

export function QRCodeDisplay({ data, size = 256 }: QRCodeDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="bg-white p-4 rounded-lg">
        <QRCodeSVG
          value={data}
          size={size}
          level="M"
          includeMargin={true}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Scannez ce code avec un autre appareil pour partager les données
      </p>
    </div>
  );
}
