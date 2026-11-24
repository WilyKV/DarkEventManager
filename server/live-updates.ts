import { freeMealPath, staffCardPath } from "../shared/card-scan";
import { demoDataPath } from "../shared/demo-data";
import { eventBackupPath } from "../shared/event-backup";
import type { RequestHandler } from "express";
import { liveQueryPrefixes, matchesQueryPrefix, type LiveScope } from "../shared/live-updates";
import { wsSyncServer } from "./websocket-sync";

function mutationScope(method: string, path: string): LiveScope | undefined {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
  if (path === `${eventBackupPath}/restore` || matchesQueryPrefix(path, freeMealPath)) return "all";
  if (matchesQueryPrefix(path, staffCardPath)) return "roster";
  if (liveQueryPrefixes.configuration.includes(path)) return "configuration";
  if (liveQueryPrefixes.roster.some(prefix => matchesQueryPrefix(path, prefix)) || path === "/api/zombie-offline/sync") return "roster";
  if (liveQueryPrefixes.sales.some(prefix => matchesQueryPrefix(path, prefix))) return "sales";
  if ([demoDataPath, "/api/data/import-all", "/api/data/reset", "/api/data/qr-import", "/api/admin/end-event"].includes(path)) return "all";
}

export const publishLiveChanges: RequestHandler = (req, res, next) => {
  const scope = mutationScope(req.method, req.path.replace(/\/$/, "").toLowerCase());
  if (scope) {
    res.once("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) wsSyncServer.notifyDataChanged(scope);
    });
  }
  next();
};
