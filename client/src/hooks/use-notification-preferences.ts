import { useState, useEffect } from "react";

const STORAGE_KEY = "notification_preferences";

interface NotificationPreferences {
  enabled: boolean;
  eventTypes: {
    meal: boolean;
    briefing: boolean;
    game: boolean;
    exit: boolean;
  };
  timeSlots: {
    [key: number]: boolean; // time slot ID -> enabled
  };
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  eventTypes: {
    meal: true,
    briefing: true,
    game: true,
    exit: true,
  },
  timeSlots: {},
};

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const toggleEnabled = () => {
    setPreferences(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  const toggleEventType = (eventType: keyof NotificationPreferences["eventTypes"]) => {
    setPreferences(prev => ({
      ...prev,
      eventTypes: {
        ...prev.eventTypes,
        [eventType]: !prev.eventTypes[eventType],
      },
    }));
  };

  const toggleTimeSlot = (timeSlotId: number) => {
    setPreferences(prev => {
      const currentValue = prev.timeSlots[timeSlotId] ?? true; // Default to true if undefined
      return {
        ...prev,
        timeSlots: {
          ...prev.timeSlots,
          [timeSlotId]: !currentValue,
        },
      };
    });
  };

  const isTimeSlotEnabled = (timeSlotId: number): boolean => {
    // If not explicitly set, default to true
    return preferences.timeSlots[timeSlotId] !== false;
  };

  return {
    preferences,
    toggleEnabled,
    toggleEventType,
    toggleTimeSlot,
    isTimeSlotEnabled,
  };
}
