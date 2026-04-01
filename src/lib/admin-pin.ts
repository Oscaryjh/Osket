const ADMIN_PIN_KEY = "osket.security.adminPin.v1";

export function loadAdminPin(defaultValue = "0000") {
  try {
    const raw = localStorage.getItem(ADMIN_PIN_KEY);
    if (!raw) return defaultValue;
    const s = String(raw).trim();
    return s || defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveAdminPin(pin: string) {
  const s = String(pin || "").trim();
  if (!/^\d{4,8}$/.test(s)) throw new Error("invalid_pin");
  localStorage.setItem(ADMIN_PIN_KEY, s);
  return s;
}

export function verifyAdminPin(input: string) {
  return String(input || "").trim() === loadAdminPin();
}
