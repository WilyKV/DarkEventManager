import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TimeSlot } from "@shared/schema";
import { format, differenceInMinutes } from "date-fns";
import { useEventDay } from "./use-event-day";

export interface TimingEvent {
  id: string;
  type: "meal" | "briefing" | "game" | "exit";
  timeSlot: TimeSlot;
  time: Date;
  label: string;
  minutesUntil: number;
}

const EVENT_TYPES = [
  { key: "mealTime" as const, type: "meal" as const, label: "Repas" },
  { key: "briefingTime" as const, type: "briefing" as const, label: "Briefing" },
  { key: "gameTime" as const, type: "game" as const, label: "Début du jeu" },
  { key: "exitTime" as const, type: "exit" as const, label: "Sortie" },
];

const NOTIFICATION_WINDOW_MINUTES = 60; // Show events within next 60 minutes

export function useTimingNotifications() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { data: event } = useEventDay();

  // Fetch all time slots
  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots"],
  });

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const day = event?.eventDay ?? format(currentTime, "yyyy-MM-dd");

  // Calculate upcoming events
  const upcomingEvents: TimingEvent[] = timeSlots.flatMap(slot => {
    return EVENT_TYPES.flatMap(({ key, type, label }) => {
      if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(slot[key])) return [];
      const time = new Date(`${day}T${slot[key]}`);
      const minutesUntil = differenceInMinutes(time, currentTime);
      
      return [{
        id: `${slot.id}-${type}`,
        type,
        timeSlot: slot,
        time,
        label: `${label} - ${slot.name}`,
        minutesUntil,
      }];
    });
  })
  .filter(event => {
    // Show events that are happening now (>= 0) or upcoming
    // and within the notification window
    return event.minutesUntil >= 0 && event.minutesUntil <= NOTIFICATION_WINDOW_MINUTES;
  })
  .sort((a, b) => a.minutesUntil - b.minutesUntil); // Sort by soonest first

  return {
    upcomingEvents,
    currentTime,
  };
}
