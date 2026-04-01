export type AuditActorType = "platform" | "venue_owner" | "host_admin" | "host_staff";

export type AuditLogEntry = {
  id: string;
  createdAtUtc: string;
  venueId: string;
  banquetId?: string;

  actorType: AuditActorType;
  actorId?: string;
  actorPhone?: string;

  action: string;
  result: "success" | "fail";
  reason?: string;
  meta?: Record<string, any>;
};

const KEY = "osket.audit.logs.v1";
const RETENTION_DAYS = 180;

function prune(list: AuditLogEntry[]) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return list.filter((x) => Date.parse(x.createdAtUtc) >= cutoff);
}

export function loadAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return prune(parsed as AuditLogEntry[]);
  } catch {
    return [];
  }
}

export function saveAuditLogs(list: AuditLogEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(prune(list)));
}

export function appendAuditLog(entry: AuditLogEntry) {
  const list = loadAuditLogs();
  list.unshift(entry);
  saveAuditLogs(list);
}

export function newAuditId() {
  return "aud_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
