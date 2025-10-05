import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { ParticipantWithRelations } from "@shared/schema";
import { Card } from "@/components/ui/card";

interface ParticipantBadgeProps {
  participant: ParticipantWithRelations;
}

export function ParticipantBadge({ participant }: ParticipantBadgeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        `PARTICIPANT:${participant.id}`,
        {
          width: 200,
          margin: 2,
          color: {
            dark: "#0a0f0a",
            light: "#ffffff",
          },
        }
      );
    }
  }, [participant.id]);

  return (
    <Card className="badge-card w-[400px] h-[600px] p-8 flex flex-col items-center justify-between bg-background border-2">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-display text-primary uppercase">
          Zombinthedark
        </h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          {participant.type === "zombie" ? "Zombie" : "Survivant"}
        </p>
      </div>

      <div className="text-center space-y-6 flex-1 flex flex-col justify-center">
        <div className="space-y-1">
          <h2 className="text-4xl font-bold">
            {participant.firstName}
          </h2>
          <h2 className="text-4xl font-bold">
            {participant.lastName}
          </h2>
        </div>

        <div className="space-y-3">
          {participant.squad && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Squad</p>
              <p className="text-2xl font-semibold text-primary">
                #{participant.squad.number}
              </p>
            </div>
          )}

          {participant.lockerNumber && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Casier</p>
              <p className="text-3xl font-mono font-bold text-primary">
                {participant.lockerNumber}
              </p>
            </div>
          )}

          {participant.timeSlot && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Créneau</p>
              <p className="text-lg font-medium">
                {participant.timeSlot.name}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <canvas 
          ref={canvasRef} 
          className="bg-white p-2 rounded-lg"
          data-testid="qr-code-canvas"
        />
        <p className="text-xs text-muted-foreground">
          ID: {participant.id}
        </p>
      </div>
    </Card>
  );
}
