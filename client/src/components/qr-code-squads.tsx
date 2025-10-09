import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { Card } from './ui/card';
import { Users } from 'lucide-react';

interface Squad {
  id: number;
  number: number;
  type: string;
  timeSlotId: number;
}

interface QRCodeSquadsProps {
  type?: string; // 'zombie', 'survivant', 'staff', ou undefined pour tous
  size?: number;
}

export function QRCodeSquads({ type, size = 200 }: QRCodeSquadsProps) {
  const { data: squads = [] } = useQuery<Squad[]>({
    queryKey: ['/api/squads/with-participants', { type }],
    queryFn: async () => {
      const url = type ? `/api/squads/with-participants?type=${type}` : '/api/squads/with-participants';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch squads');
      return res.json();
    },
  });

  // Les données sont déjà filtrées par le backend
  const filteredSquads = squads;

  // Format minimal : type="S" + array simplifié
  const minimalData = {
    t: "S", // type = Squads
    d: filteredSquads.map(squad => ({
      n: squad.number,     // number
      ty: squad.type,      // type
      ts: squad.timeSlotId // timeSlot
    }))
  };

  const qrData = JSON.stringify(minimalData);

  return (
    <Card className="p-4">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="w-4 h-4" />
          <span>QR Squads {type && `(${type})`}</span>
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
          {filteredSquads.length} squad{filteredSquads.length > 1 ? 's' : ''}
        </p>
      </div>
    </Card>
  );
}
