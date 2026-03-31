export type HostRole = "host_admin" | "host_staff";

export type HostSession = {
  phone: string;
  venueId: string;
  banquetId: string; // 单宴会授权
  role: HostRole;
  createdAtUtc: string;
};

const HOST_SESSION_KEY = "osket.host.session";

export function loadHostSession(): HostSession | null {
  try {
    const raw = localStorage.getItem(HOST_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s.phone !== "string" || typeof s.venueId !== "string" || typeof s.banquetId !== "string") return null;
    return s;
  } catch {
    return null;
  }
}

export function saveHostSession(session: HostSession | null) {
  if (!session) {
    localStorage.removeItem(HOST_SESSION_KEY);
    return;
  }
  localStorage.setItem(HOST_SESSION_KEY, JSON.stringify(session));
}

export function isHostAuthed() {
  return !!loadHostSession();
}
