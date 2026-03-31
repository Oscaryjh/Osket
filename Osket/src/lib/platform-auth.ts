export type PlatformSession = { ok: true; createdAtUtc: string };

const PLATFORM_SESSION_KEY = "osket.platform.session";

export function loadPlatformSession(): PlatformSession | null {
  try {
    const raw = localStorage.getItem(PLATFORM_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.ok !== true) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePlatformSession(session: PlatformSession | null) {
  if (!session) {
    localStorage.removeItem(PLATFORM_SESSION_KEY);
    return;
  }
  localStorage.setItem(PLATFORM_SESSION_KEY, JSON.stringify(session));
}

export function isPlatformAuthed() {
  return !!loadPlatformSession();
}
