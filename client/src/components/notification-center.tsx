import { Bell, Clock, Utensils, ClipboardList, Gamepad2, DoorOpen, Skull, UserCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTimingNotifications } from "@/hooks/use-timing-notifications";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { useQuery } from "@tanstack/react-query";
import { TimeSlot } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function NotificationCenter() {
  const { upcomingEvents } = useTimingNotifications();
  const { preferences, toggleEnabled, toggleEventType, toggleTimeSlot, isTimeSlotEnabled } = useNotificationPreferences();

  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots"],
  });

  // Filter events based on preferences
  const filteredEvents = preferences.enabled 
    ? upcomingEvents.filter(event => {
        const eventTypeEnabled = preferences.eventTypes[event.type as keyof typeof preferences.eventTypes];
        const timeSlotEnabled = isTimeSlotEnabled(event.timeSlot.id);
        return eventTypeEnabled && timeSlotEnabled;
      })
    : [];

  const notificationCount = filteredEvents.length;

  const formatTimeUntil = (minutes: number): string => {
    if (minutes < 1) return "Maintenant";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "meal":
        return Utensils;
      case "briefing":
        return ClipboardList;
      case "game":
        return Gamepad2;
      case "exit":
        return DoorOpen;
      default:
        return Clock;
    }
  };

  const getParticipantIcon = (participantType: string) => {
    return participantType === "zombie" ? Skull : UserCircle;
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "meal":
        return "bg-chart-2 text-white";
      case "briefing":
        return "bg-chart-1 text-white";
      case "game":
        return "bg-primary text-primary-foreground";
      case "exit":
        return "bg-chart-3 text-white";
      default:
        return "bg-secondary";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span 
              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
              data-testid="badge-notification-count"
            >
              {notificationCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end" data-testid="popover-notifications">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Notifications</h3>
            <Badge variant="secondary" data-testid="text-event-count">
              {notificationCount} événement{notificationCount !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Preferences */}
          <Card className="p-4 bg-muted/50">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications-enabled" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Activer les notifications
                </Label>
                <Switch
                  id="notifications-enabled"
                  checked={preferences.enabled}
                  onCheckedChange={toggleEnabled}
                  data-testid="switch-notifications-enabled"
                />
              </div>

              {preferences.enabled && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Types d'événements:</p>
                    {[
                      { key: 'meal' as const, label: 'Repas', icon: Utensils },
                      { key: 'briefing' as const, label: 'Briefing', icon: ClipboardList },
                      { key: 'game' as const, label: 'Jeu', icon: Gamepad2 },
                      { key: 'exit' as const, label: 'Sortie', icon: DoorOpen },
                    ].map(({ key, label, icon: Icon }) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label htmlFor={`event-${key}`} className="flex items-center gap-2 text-sm">
                          <Icon className="w-3 h-3" />
                          {label}
                        </Label>
                        <Switch
                          id={`event-${key}`}
                          checked={preferences.eventTypes[key]}
                          onCheckedChange={() => toggleEventType(key)}
                          data-testid={`switch-event-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                  
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Créneaux horaires:</p>
                    <ScrollArea className="h-[120px]">
                      {timeSlots.map(slot => (
                        <div key={slot.id} className="flex items-center justify-between py-1">
                          <Label htmlFor={`slot-${slot.id}`} className="text-sm">
                            {slot.name}
                          </Label>
                          <Switch
                            id={`slot-${slot.id}`}
                            checked={isTimeSlotEnabled(slot.id)}
                            onCheckedChange={() => toggleTimeSlot(slot.id)}
                            data-testid={`switch-slot-${slot.id}`}
                          />
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Separator />

          {!preferences.enabled ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Notifications désactivées
              </p>
            </Card>
          ) : filteredEvents.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">
                Aucun événement dans l'heure à venir
              </p>
            </Card>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {filteredEvents.map(event => {
                  const EventIcon = getEventIcon(event.type);
                  const ParticipantIcon = getParticipantIcon(event.timeSlot.type);
                  
                  return (
                    <Card 
                      key={event.id} 
                      className="p-4 hover-elevate"
                      data-testid={`card-event-${event.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-primary" data-testid={`icon-${event.type}`}>
                          <EventIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-foreground">
                              {event.label}
                            </p>
                            <Badge 
                              className={getEventColor(event.type)}
                              data-testid={`badge-time-${event.id}`}
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              {formatTimeUntil(event.minutesUntil)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {event.time.toLocaleTimeString('fr-FR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                          <Badge variant="outline" className="text-xs flex items-center gap-1 w-fit">
                            <ParticipantIcon className="w-3 h-3" />
                            {event.timeSlot.type === "zombie" ? "Zombie" : "Survivant"}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
