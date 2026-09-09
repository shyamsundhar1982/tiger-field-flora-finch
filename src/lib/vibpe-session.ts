import type { IbpeScenarioRequest } from "@/lib/ibpe-scenario-lab";

export type VibpeSessionState = {
  activeScenario?: IbpeScenarioRequest;
  previousScenario?: IbpeScenarioRequest;
  planningHorizonMonths?: number;
  referencedProducts: string[];
  lastIntent?: string;
  lastQuestion?: string;
};

const sessions = new Map<string, VibpeSessionState>();

export function getVibpeSession(sessionKey: string): VibpeSessionState {
  return sessions.get(sessionKey) ?? { referencedProducts: [] };
}

export function updateVibpeSession(sessionKey: string, patch: Partial<VibpeSessionState>) {
  const current = getVibpeSession(sessionKey);
  const next = { ...current, ...patch };
  sessions.set(sessionKey, next);
  return next;
}

export function clearVibpeSession(sessionKey: string) {
  sessions.delete(sessionKey);
}

// Runtime-local advisory state only. This is deliberately not a governed business datastore.
// Persistent governed decisions must remain in their owning audit/decision services.
