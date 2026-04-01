import { nanoid } from "nanoid";

const TOKEN_KEY = "wedding-ledger.demo.tokens.v1";

export type DemoTokenRecord = {
  token: string;
  eventId: string; // in demo we treat this as banquetId
  eventName: string;
  createdAtUtc: string;
};

export function loadTokens(): DemoTokenRecord[] {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveTokens(list: DemoTokenRecord[]) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(list));
}

export function createToken(eventId: string, eventName: string) {
  // URL-safe
  const token = nanoid(32);
  const rec: DemoTokenRecord = {
    token,
    eventId,
    eventName,
    createdAtUtc: new Date().toISOString(),
  };
  const list = loadTokens();
  list.unshift(rec);
  saveTokens(list);
  return rec;
}

export function rotateToken(oldToken: string) {
  const list = loadTokens();
  const idx = list.findIndex((x) => x.token === oldToken);
  if (idx === -1) return null;
  const old = list[idx];
  const next = { ...old, token: nanoid(32), createdAtUtc: new Date().toISOString() };
  list[idx] = next;
  saveTokens(list);
  return next;
}

export function deleteToken(token: string) {
  const list = loadTokens().filter((x) => x.token !== token);
  saveTokens(list);
}

export function tokenToEventId(token: string) {
  return loadTokens().find((x) => x.token === token)?.eventId || null;
}

export function findTokenByEventId(eventId: string) {
  return loadTokens().find((x) => x.eventId === eventId) || null;
}
