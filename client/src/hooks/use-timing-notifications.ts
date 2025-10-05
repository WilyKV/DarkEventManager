import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TimeSlot } from "@shared/schema";
import { format, parseISO, isBefore, differenceInMinutes, addMinutes } from "date-fns";
import { fr } from "date-fns/locale";

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

  // Parse time string (HH:MM) and create a Date object for today
  const parseTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  // Calculate upcoming events
  const upcomingEvents: TimingEvent[] = timeSlots.flatMap(slot => {
    return EVENT_TYPES.map(({ key, type, label }) => {
      const time = parseTime(slot[key]);
      const minutesUntil = differenceInMinutes(time, currentTime);
      
      return {
        id: `${slot.id}-${type}`,
        type,
        timeSlot: slot,
        time,
        label: `${label} - ${slot.name}`,
        minutesUntil,
      };
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
