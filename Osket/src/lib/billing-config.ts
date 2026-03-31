const RATE_KEY = "osket.billing.rateRmPerHead";

export function loadRateRmPerHead(defaultValue = 0.5) {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (!raw) return defaultValue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return defaultValue;
    return Math.round(n * 100) / 100;
  } catch {
    return defaultValue;
  }
}

export function saveRateRmPerHead(rate: number) {
  const n = Math.round(Number(rate) * 100) / 100;
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid_rate");
  localStorage.setItem(RATE_KEY, String(n));
  return n;
}
