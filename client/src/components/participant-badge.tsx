import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Check } from "lucide-react";
import { ParticipantWithRelations } from "@shared/schema";

interface ParticipantBadgeProps {
  participant: ParticipantWithRelations;
}

export function ParticipantBadge({ participant }: ParticipantBadgeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrData, setQrData] = useState<string>("");

  // Fetch participant data dynamically every 5 seconds for real-time updates
  const { data: updatedParticipant } = useQuery<ParticipantWithRelations>({
    queryKey: [`/api/participants/${participant.id}`],
    refetchInterval: 5000, // Refresh every 5 seconds
    initialData: participant,
  });

  // Use updated participant data if available, otherwise use prop
  const currentParticipant = updatedParticipant || participant;

  const mealTaken = currentParticipant.freeMealClaimed === true;

  // Fetch encrypted QR data
  const { data: qrResponse } = useQuery<{ qrData: string }>({
    queryKey: [`/api/qr/generate/${currentParticipant.id}`],
    enabled: !!currentParticipant.secretCode,
  });

  useEffect(() => {
    if (qrResponse?.qrData) {
      setQrData(qrResponse.qrData);
    }
  }, [qrResponse]);

  useEffect(() => {
    if (canvasRef.current && qrData) {
      const isZombie = currentParticipant.type === "zombie";
      const isStaff = currentParticipant.type === "staff";
      QRCode.toCanvas(
        canvasRef.current,
        qrData,
        {
          width: 120,
          margin: 1,
          color: {
            dark: isZombie ? "#7f1d1d" : isStaff ? "#166534" : "#1e3a8a",
            light: "#ffffff",
          },
        }
      );
    }
  }, [qrData, currentParticipant.type]);

  const isZombie = currentParticipant.type === "zombie";
  const isStaff = currentParticipant.type === "staff";

  return (
    <div
      className="badge-card relative w-[400px] h-[600px] rounded-2xl overflow-hidden shadow-2xl print:shadow-none"
      style={{
        backgroundImage: isZombie
          ? 'radial-gradient(circle at 20% 30%, rgb(112 31 31) 0%, #161616c2 50%), radial-gradient(circle at 80% 70%, rgb(255 0 0) 0%, #141414 50%)'
          : isStaff
          ? 'radial-gradient(circle at 20% 30%, rgb(22 101 52) 0%, #161616c2 50%), radial-gradient(circle at 80% 70%, rgb(34 197 94) 0%, #141414 50%)'
          : 'radial-gradient(circle at 20% 30%, rgb(31 41 112) 0%, #161616c2 50%), radial-gradient(circle at 80% 70%, rgb(0 112 243) 0%, #141414 50%)',
      }}
    >
      {/* Background pattern overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: isZombie
            ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
            : 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)',
        }}
      />

      {/* Top blood/water drip effect for zombies */}
      {isZombie && (
        <div className="absolute top-0 left-0 right-0 h-20">
          <svg className="w-full h-full" viewBox="0 0 400 80" preserveAspectRatio="none">
            <path
              d="M0,0 L0,40 Q50,60 100,40 T200,40 T300,40 T400,40 L400,0 Z"
              fill="rgba(127, 29, 29, 0.6)"
            />
            <path
              d="M0,0 L0,30 Q40,50 80,30 T160,30 T240,30 T320,30 T400,30 L400,0 Z"
              fill="rgba(185, 28, 28, 0.4)"
            />
          </svg>
        </div>
      )}

      {/* Content container */}
      <div className="relative z-10 h-full flex flex-col p-8">
        {/* Header */}
        <div className="text-center space-y-1 mb-6">
          <h1 className="text-3xl font-black text-white uppercase tracking-wider drop-shadow-lg"
            style={{
              textShadow: isZombie
                ? '0 0 20px rgba(220, 38, 38, 0.8), 0 2px 4px rgba(0,0,0,0.8)'
                : '0 0 20px rgba(59, 130, 246, 0.8), 0 2px 4px rgba(0,0,0,0.8)',
            }}
          >
            Zombinthedark
          </h1>
          <div className={`
            inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest
            ${isZombie
              ? "bg-red-600 text-white border-2 border-red-400"
              : isStaff
              ? "bg-green-600 text-white border-2 border-green-400"
              : "bg-blue-600 text-white border-2 border-blue-400"
            }
          `}>
            {isZombie ? "🧟 Zombie" : isStaff ? "👥 Staff" : "🛡️ Survivant"}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col justify-center items-center space-y-6">
          {/* Name */}
          <div className="text-center space-y-1 bg-black/30 backdrop-blur-sm rounded-lg px-6 py-4 w-full border border-white/20">
            <h2 className="text-4xl font-black text-white uppercase tracking-wide"
              style={{
                textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 0 30px rgba(255,255,255,0.3)',
              }}
            >
              {currentParticipant.firstName}
            </h2>
            <h2 className="text-4xl font-black text-white uppercase tracking-wide"
              style={{
                textShadow: '0 2px 10px rgba(0,0,0,0.8), 0 0 30px rgba(255,255,255,0.3)',
              }}
            >
              {currentParticipant.lastName}
            </h2>
          </div>

          {/* Squad & Timeslot */}
          <div className="flex gap-4 w-full">
            {/* Squad - only for zombie and survivant, not staff */}
            {!isStaff && (
              <div className={`
                flex-1 text-center space-y-2 rounded-lg px-4 py-3 border-2
                ${isZombie
                  ? "bg-red-900/40 border-red-500/50 backdrop-blur-sm"
                  : "bg-blue-900/40 border-blue-500/50 backdrop-blur-sm"
                }
              `}>
                <p className="text-xs text-white/70 uppercase tracking-wider font-semibold">Squad</p>
                {/* White box: shows squad number if assigned, empty for manual writing otherwise */}
                <div className="mx-auto w-14 h-14 bg-white border-2 border-gray-300 rounded flex items-center justify-center">
                  {currentParticipant.squad?.number != null ? (
                    <span className="text-gray-900 text-3xl font-bold font-mono leading-none">
                      {currentParticipant.squad.number}
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            {/* Timeslot / Attribution */}
            {currentParticipant.timeSlot && (
              <div className={`
                ${isStaff ? 'w-full' : 'flex-1'} text-center space-y-1 rounded-lg px-4 py-3 border-2
                ${isZombie
                  ? "bg-red-900/40 border-red-500/50 backdrop-blur-sm"
                  : isStaff
                  ? "bg-green-900/40 border-green-500/50 backdrop-blur-sm"
                  : "bg-blue-900/40 border-blue-500/50 backdrop-blur-sm"
                }
              `}>
                <p className="text-xs text-white/70 uppercase tracking-wider font-semibold">
                  {isStaff ? "Attribution" : "Créneau"}
                </p>
                <p className="text-sm font-bold text-white">
                  {currentParticipant.timeSlot.name}
                </p>
                <div className="text-xs text-white/60 space-y-0.5">
                  <p>Briefing: {currentParticipant.timeSlot.briefingTime}</p>
                  <p>Jeu: {currentParticipant.timeSlot.gameTime} - {currentParticipant.timeSlot.exitTime}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* QR Code and Checkboxes side by side */}
        <div className="mt-4 flex gap-3 items-center">
          {/* QR Code - Left side */}
          <div className={`
            p-2 rounded-lg border-3
            ${isZombie
              ? "bg-white border-red-600"
              : isStaff
              ? "bg-white border-green-600"
              : "bg-white border-blue-600"
            }
          `}>
            {qrData ? (
              <canvas
                ref={canvasRef}
                className="bg-white rounded"
                data-testid="qr-code-canvas"
              />
            ) : (
              <div className="w-[120px] h-[120px] flex items-center justify-center bg-gray-100 rounded">
                <p className="text-xs text-gray-500">...</p>
              </div>
            )}
          </div>

          {/* Checkboxes - Right side */}
          <div className="flex-1 space-y-2">
            <div className={`
              flex items-center gap-2 rounded-lg px-3 py-2 border
              ${isZombie
                ? "bg-red-900/20 border-red-500/30"
                : isStaff
                ? "bg-green-900/20 border-green-500/30"
                : "bg-blue-900/20 border-blue-500/30"
              }
            `}>
              {mealTaken ? (
                <div className="w-4 h-4 border-2 border-green-600 rounded bg-green-600 flex-shrink-0 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              ) : (
                <div className="w-4 h-4 border-2 border-white rounded bg-white flex-shrink-0"></div>
              )}
              <span className="text-sm text-white font-medium">Repas</span>
            </div>
            <div className={`
              flex items-center gap-2 rounded-lg px-3 py-2 border
              ${isZombie
                ? "bg-red-900/20 border-red-500/30"
                : isStaff
                ? "bg-green-900/20 border-green-500/30"
                : "bg-blue-900/20 border-blue-500/30"
              }
            `}>
              {currentParticipant.returnedAt != null ? (
                <div className="w-4 h-4 border-2 border-green-600 rounded bg-green-600 flex-shrink-0 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </div>
              ) : (
                <div className="w-4 h-4 border-2 border-white rounded bg-white flex-shrink-0"></div>
              )}
              <span className="text-sm text-white font-medium">Goodies</span>
            </div>
          </div>
        </div>

        {!participant.secretCode && (
          <p className="text-xs text-yellow-300 text-center mt-2">
            ⚠️ Code secret manquant
          </p>
        )}
      </div>

      {/* Corner decorations */}
      <div className={`
        absolute top-0 right-0 w-20 h-20 opacity-20
        ${isZombie ? "bg-red-700" : "bg-blue-700"}
      `}
        style={{
          clipPath: 'polygon(100% 0, 0 0, 100% 100%)',
        }}
      />
      <div className={`
        absolute bottom-0 left-0 w-20 h-20 opacity-20
        ${isZombie ? "bg-red-700" : "bg-blue-700"}
      `}
        style={{
          clipPath: 'polygon(0 100%, 0 0, 100% 100%)',
        }}
      />
    </div>
  );
}
