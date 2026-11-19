import { checkInPath } from "./check-in";
import { demoDataPath } from "./demo-data";

const roster = [checkInPath, "/api/participants", "/api/time-slots", "/api/squads", "/api/dashboard"];
const sales = ["/api/purchases", "/api/meal-purchases", "/api/shop-items", "/api/meal-items", "/api/discounts", "/api/meal-discounts", "/api/dashboard"];
const configuration = ["/api/sync/config"];
const administration = [demoDataPath, "/api/auth/users", "/api/audit-logs"];

export const liveQueryPrefixes = {
  roster,
  sales,
  configuration,
  all: Array.from(new Set([...roster, ...sales, ...configuration, ...administration])),
};

export type LiveScope = keyof typeof liveQueryPrefixes;

export function matchesQueryPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?");
}
