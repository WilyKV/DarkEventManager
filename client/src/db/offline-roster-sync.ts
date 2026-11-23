import { cardsPath } from "@shared/participant-card";
import { apiRequest } from "@/lib/queryClient";
import { offlineCheckInApi, type OfflinePlayerReceipt, type OfflineSyncResult } from "@shared/zombie-offline";
import type { LocalOfflineSession } from "./zombie-offline";

const rosterWriteUrl = `${offlineCheckInApi}/participants`;

/** Persist each acknowledgement so reconnecting resumes without recreating players. */
export async function sendOfflineChanges(
  data: LocalOfflineSession,
  persist: (data: LocalOfflineSession) => Promise<LocalOfflineSession>,
  describeError: (error: unknown) => string,
) {
  let current = data;
  let sent = 0;
  for (const id of current.archives ?? []) {
    const player = current.participants.find(candidate => candidate.id === id);
    if (!player) continue;
    if (!current.archiveAttempts?.includes(id)) {
      current = await persist({ ...current, archiveAttempts: [...(current.archiveAttempts ?? []), id] });
    }
    const { identity, revision } = player;
    const archiveAttempts = current.archiveAttempts?.filter(playerId => playerId !== id);
    try {
      await apiRequest("DELETE", `${rosterWriteUrl}/${id}`, { ownerId: current.ownerId, identity, revision }, AbortSignal.timeout(20_000));
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith("409:"))) throw error;
      current = await persist({ ...current, archiveAttempts,
        conflicts: { ...current.conflicts, [id]: describeError(error) } });
      continue;
    }
    const conflicts = { ...current.conflicts };
    const capacityOverrides = { ...current.capacityOverrides };
    delete conflicts[id];
    delete capacityOverrides[id];
    const pendingPhotos = { ...current.pendingPhotos };
    delete pendingPhotos[id];
    current = await persist({
      ...current, archiveAttempts, conflicts, capacityOverrides, pendingPhotos,
      archives: current.archives?.filter(playerId => playerId !== id),
      pending: current.pending.filter(playerId => playerId !== id),
      participants: current.participants.filter(candidate => candidate.id !== id),
    });
    sent++;
  }
  for (const player of current.participants.filter(candidate => candidate.id < 0)) {
    const { id, firstName, lastName, type, timeSlotId } = player;
    const addition = current.additions?.[id];
    if (!addition) continue;
    if (!addition.started) {
      current = await persist({ ...current, additions: { ...current.additions, [id]: { ...addition, started: true } } });
    }
    let receipt: OfflinePlayerReceipt;
    try {
      const response = await apiRequest("POST", rosterWriteUrl, {
        ownerId: current.ownerId, requestId: addition.requestId, player: { firstName, lastName, type, timeSlotId },
      }, AbortSignal.timeout(20_000));
      receipt = await response.json() as OfflinePlayerReceipt;
      if (!Number.isSafeInteger(receipt.id) || receipt.id <= 0 || !/^[a-f0-9]{64}$/.test(receipt.identity)
        || !/^[a-f0-9]{64}$/.test(receipt.revision) || current.participants.some(candidate => candidate.id === receipt.id)) {
        throw new Error("Réponse de création invalide. La fiche locale est conservée.");
      }
    } catch (error) {
      if (!(error instanceof Error && error.message.startsWith("409:"))) throw error;
      current = await persist({
        ...current, additions: { ...current.additions, [id]: { requestId: addition.requestId } },
        conflicts: { ...current.conflicts, [id]: describeError(error) },
      });
      continue;
    }
    const additions = { ...current.additions };
    const conflicts = { ...current.conflicts };
    const capacityOverrides = { ...current.capacityOverrides };
    if (capacityOverrides[id] !== undefined) capacityOverrides[receipt.id] = capacityOverrides[id];
    delete additions[id];
    delete conflicts[id];
    delete capacityOverrides[id];
    const pendingPhotos = { ...current.pendingPhotos };
    if (Object.hasOwn(pendingPhotos, id)) pendingPhotos[receipt.id] = pendingPhotos[id];
    delete pendingPhotos[id];
    current = await persist({
      ...current, additions, conflicts, capacityOverrides, pendingPhotos,
      pending: current.pending.map(playerId => playerId === id ? receipt.id : playerId),
      participants: current.participants.map(candidate => candidate.id === id ? { ...candidate, ...receipt } : candidate),
    });
  }
  const archives = new Set(current.archives);
  const pending = new Set(current.pending);
  const byId = new Map(current.participants.map(player => [player.id, player]));
  const updates = current.pending.flatMap(id => {
    const player = byId.get(id);
    if (!player || id < 0 || archives.has(id)) return [];
    const { identity, revision, state } = player;
    const allowOverCapacity = state.squadId !== null && current.capacityOverrides?.[id] === state.squadId;
    return [{ id, identity, revision, state, ...(allowOverCapacity && { allowOverCapacity }) }];
  });
  for (let start = 0; start < updates.length; start += 50) {
    const batch = updates.slice(start, start + 50);
    const response = await apiRequest("POST", `${offlineCheckInApi}/sync`, { ownerId: current.ownerId, updates: batch }, AbortSignal.timeout(20_000));
    const { results } = await response.json() as { results: OfflineSyncResult[] };
    const resultsById = new Map(results.map(result => [result.id, result]));
    if (results.length !== batch.length || batch.some(update => !resultsById.has(update.id))) {
      throw new Error("Réponse du serveur incomplète. Les modifications restent sur cet appareil.");
    }
    const conflicts = { ...current.conflicts };
    const capacityOverrides = { ...current.capacityOverrides };
    for (const result of results) {
      if ("error" in result) conflicts[result.id] = result.error;
      else {
        delete conflicts[result.id];
        delete capacityOverrides[result.id];
        pending.delete(result.id);
        sent++;
      }
    }
    current = await persist({
      ...current, pending: Array.from(pending), conflicts, capacityOverrides,
      participants: current.participants.map(player => {
        const result = resultsById.get(player.id);
        return result && "revision" in result ? { ...player, revision: result.revision } : player;
      }),
    });
  }
  for (const [key, photo] of Object.entries(current.pendingPhotos ?? {})) {
    const id = Number(key);
    const player = byId.get(id);
    if (!player || id <= 0 || archives.has(id)) continue;
    await apiRequest("PATCH", `${cardsPath}/${id}/photo`, {
      ownerId: current.ownerId, identity: player.identity, photo,
    }, AbortSignal.timeout(20_000));
    const pendingPhotos = { ...current.pendingPhotos };
    delete pendingPhotos[id];
    current = await persist({ ...current, pendingPhotos });
    if (!updates.some(update => update.id === id)) sent++;
  }
  return { sent, remaining: new Set([...(current.archives ?? []), ...current.pending,
    ...Object.keys(current.pendingPhotos ?? {}).map(Number)]).size };
}
