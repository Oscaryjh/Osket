import { nanoid } from "nanoid";

export type WalletLedgerType = "topup" | "charge" | "refund" | "adjustment";

export type WalletLedgerEntry = {
  entryId: string;
  type: WalletLedgerType;
  amountRm: number; // +topup/+refund/+adjustment, -charge/-adjustment
  balanceAfterRm: number;
  createdAtUtc: string;
  createdBy: string; // platform / system

  note?: string;

  venueId: string;
  // 关联到活动/账单（用于扣费/回滚）
  banquetId?: string;
  billingSnapshotId?: string;
  billingVersion?: number;
};

export type VenueAccount = {
  id: string;
  name: string;
  phone: string;
  createdAtUtc: string;

  walletBalanceRm: number;
  walletLedger: WalletLedgerEntry[];
};

// 注意：在 AnyGen 预览里，iframe 与新Tab 可能出现 storage 分区。
// 为了让“复制登录链接到新Tab”也能工作，我们会在登录链接里携带场地信息，
// 登录页若检测到本地缺少该场地，会自动写入这里。
const VENUES_KEY = "osket.platform.venues.v1";
const SESSION_KEY = "osket.session";

export function loadVenues(): VenueAccount[] {
  try {
    const raw = localStorage.getItem(VENUES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // 兼容旧数据：补齐钱包字段
    return parsed
      .filter(
        (v) =>
          v && typeof v.id === "string" && typeof v.name === "string" && typeof v.phone === "string"
      )
      .map((v) => ({
        ...v,
        walletBalanceRm: typeof v.walletBalanceRm === "number" ? v.walletBalanceRm : 0,
        walletLedger: Array.isArray(v.walletLedger) ? v.walletLedger : [],
      }));
  } catch {
    return [];
  }
}

export function saveVenues(list: VenueAccount[]) {
  localStorage.setItem(VENUES_KEY, JSON.stringify(list));
}

export function deleteVenueById(id: string) {
  const list = loadVenues();
  const next = list.filter((v) => v.id !== id);
  saveVenues(next);
  return { before: list.length, after: next.length };
}

export function upsertVenue(v: VenueAccount) {
  const list = loadVenues();
  const next = [v, ...list.filter((x) => x.id !== v.id && x.phone !== v.phone)];
  saveVenues(next);
  return v;
}

export function encodeVenueSeed(v: VenueAccount) {
  try {
    const raw = JSON.stringify({ id: v.id, name: v.name, phone: v.phone });
    return btoa(unescape(encodeURIComponent(raw)));
  } catch {
    return "";
  }
}

export function decodeVenueSeed(seed: string): VenueAccount | null {
  try {
    const raw = decodeURIComponent(escape(atob(seed)));
    const x = JSON.parse(raw);
    if (!x || typeof x.id !== "string" || typeof x.name !== "string" || typeof x.phone !== "string") return null;
    return {
      id: x.id,
      name: x.name,
      phone: normalizePhone(x.phone),
      createdAtUtc: new Date().toISOString(),
      walletBalanceRm: 0,
      walletLedger: [],
    };
  } catch {
    return null;
  }
}

export function normalizePhone(phone: string) {
  return String(phone || "")
    .trim()
    .replace(/[^0-9]/g, "");
}

export function createVenueAccount(name: string, phone: string): VenueAccount {
  return {
    id: `V_${nanoid(10)}`,
    name: name.trim(),
    phone: normalizePhone(phone),
    createdAtUtc: new Date().toISOString(),

    walletBalanceRm: 0,
    walletLedger: [],
  };
}

export function upsertVenueAccount(v: VenueAccount) {
  const next: VenueAccount = {
    id: v.id,
    name: String(v.name || "").trim() || "(未命名场地)",
    phone: normalizePhone(v.phone),
    createdAtUtc: v.createdAtUtc || new Date().toISOString(),
    walletBalanceRm: typeof v.walletBalanceRm === "number" ? v.walletBalanceRm : 0,
    walletLedger: Array.isArray(v.walletLedger) ? v.walletLedger : [],
  };

  const list = loadVenues();
  const i = list.findIndex((x) => x.id === next.id || x.phone === next.phone);
  if (i >= 0) {
    list[i] = { ...list[i], ...next };
    saveVenues(list);
    return list[i];
  }

  saveVenues([next, ...list]);
  return next;
}

export function findVenueByPhone(phone: string) {
  const p = normalizePhone(phone);
  return loadVenues().find((v) => v.phone === p) || null;
}

export type Session = { venueId: string };

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.venueId !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function requireVenueId(): string | null {
  return loadSession()?.venueId || null;
}
