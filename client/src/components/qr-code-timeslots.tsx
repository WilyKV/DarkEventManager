import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { Card } from './ui/card';
import { Clock } from 'lucide-react';

interface TimeSlot {
  id: number;
  name: string;
  type: string;
  briefingTime: string;
  gameTime: string;
}

interface QRCodeTimeSlotsProps {
  type?: string; // 'zombie', 'survivant', 'staff', ou undefined pour tous
  size?: number;
}

export function QRCodeTimeSlots({ type, size = 200 }: QRCodeTimeSlotsProps) {
  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ['/api/time-slots', { type }],
    queryFn: async () => {
      const url = type ? `/api/time-slots?type=${type}` : '/api/time-slots';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch time slots');
      return res.json();
    },
  });

  // Les données sont déjà filtrées par le backend
  const filteredSlots = timeSlots;

  // Format minimal : type="T" + array simplifié
  const minimalData = {
    t: "T", // type = TimeSlots
    d: filteredSlots.map(slot => ({
      n: slot.name,           // name
      ty: slot.type,          // type
      b: slot.briefingTime,   // briefing
      g: slot.gameTime        // game
    }))
  };

  const qrData = JSON.stringify(minimalData);

  return (
    <Card className="p-4">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="w-4 h-4" />
          <span>QR Créneaux {type && `(${type})`}</span>
        </div>
        <div className="bg-white p-2 rounded">
          <QRCodeSVG
            value={qrData}
            size={size}
            level="M"
            includeMargin={true}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {filteredSlots.length} créneau{filteredSlots.length > 1 ? 'x' : ''}
        </p>
      </div>
    </Card>
  );
}
