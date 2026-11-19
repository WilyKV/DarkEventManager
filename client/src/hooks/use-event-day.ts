import { useQuery } from "@tanstack/react-query";
import { eventDayPath } from "@shared/event-day";

export function useEventDay() {
  return useQuery<{ eventDay: string | null }>({ queryKey: [eventDayPath] });
}
