import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { Card } from './ui/card';
import { User } from 'lucide-react';

interface Participant {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  type: string;
  squadId?: number;
  checkedIn: boolean;
}

interface QRCodeParticipantsProps {
  type: string; // 'zombie', 'survivant', ou 'staff'
  size?: number;
}

export function QRCodeParticipants({ type, size = 200 }: QRCodeParticipantsProps) {
  const { data: participants = [] } = useQuery<Participant[]>({
    queryKey: ['/api/participants', { type }],
    queryFn: async () => {
      const res = await fetch(`/api/participants?type=${type}`);
      if (!res.ok) throw new Error('Failed to fetch participants');
      return res.json();
    },
  });

  // Les données sont déjà filtrées par le backend
  const filteredParticipants = participants;

  // Format minimal : type="P" + array ultra-simplifié
  const minimalData = {
    t: "P", // type = Participants
    ty: type, // type de participant (zombie/survivant/staff)
    d: filteredParticipants.map(p => ({
      fn: p.firstName,    // firstName
      ln: p.lastName,     // lastName
      e: p.email || "",   // email (optionnel)
      ph: p.phone || "",  // phone (optionnel)
      sq: p.squadId || 0  // squadId (0 si non assigné)
    }))
  };

  const qrData = JSON.stringify(minimalData);

  return (
    <Card className="p-4">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <User className="w-4 h-4" />
          <span>QR Participants ({type})</span>
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
          {filteredParticipants.length} participant{filteredParticipants.length > 1 ? 's' : ''}
        </p>
      </div>
    </Card>
  );
}
