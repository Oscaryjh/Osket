import { nanoid } from "nanoid";
import type { HostRole } from "@/lib/host-auth";

const INVITES_KEY = "osket.host.invites.v1";

export type HostInviteStatus = "active" | "revoked";
export type HostInviteMode = "single_use" | "multi_use";

export type HostInviteUse = {
  phone: string;
  usedAtUtc: string;
};

export type HostInvite = {
  token: string;
  venueId: string;
  banquetId: string; // 单宴会授权
  role: HostRole;
  invitedPhone?: string;
  mode: HostInviteMode;
  expiresAtUtc?: string;

  status: HostInviteStatus;
  createdAtUtc: string;
  createdBy: string; // venue_owner

  uses?: HostInviteUse[];

  revokedAtUtc?: string;
  revokedBy?: string;
};

export function loadHostInvites(): HostInvite[] {
  try {
    const raw = localStorage.getItem(INVITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveHostInvites(list: HostInvite[]) {
  localStorage.setItem(INVITES_KEY, JSON.stringify(list));
}

export function createHostInvite(params: {
  venueId: string;
  banquetId: string;
  role: HostRole;
  invitedPhone?: string;
  mode?: HostInviteMode;
  expiresAtUtc?: string;
  createdBy?: string;
}) {
  const inv: HostInvite = {
    token: nanoid(32),
    venueId: params.venueId,
    banquetId: params.banquetId,
    role: params.role,
    invitedPhone: params.invitedPhone,
    mode: params.mode || "single_use",
    expiresAtUtc: params.expiresAtUtc,
    status: "active",
    createdAtUtc: new Date().toISOString(),
    createdBy: params.createdBy || "venue_owner",
    uses: [],
  };
  const list = loadHostInvites();
  list.unshift(inv);
  saveHostInvites(list);
  return inv;
}

export function revokeHostInvite(token: string) {
  const list = loadHostInvites();
  const i = list.findIndex((x) => x.token === token);
  if (i < 0) return null;
  const cur = list[i];
  const next: HostInvite = { ...cur, status: "revoked", revokedAtUtc: new Date().toISOString(), revokedBy: "venue_owner" };
  list[i] = next;
  saveHostInvites(list);
  return next;
}

export function deleteHostInvite(token: string) {
  const list = loadHostInvites().filter((x) => x.token !== token);
  saveHostInvites(list);
}

export function isHostInviteExpired(invite: HostInvite) {
  if (!invite.expiresAtUtc) return false;
  return Date.parse(invite.expiresAtUtc) < Date.now();
}

export function getHostInvite(token: string) {
  return loadHostInvites().find((x) => x.token === token) || null;
}

export function redeemHostInvite(token: string, phone: string) {
  const list = loadHostInvites();
  const i = list.findIndex((x) => x.token === token);
  if (i < 0) return { ok: false as const, reason: "not_found" as const };
  const cur = list[i] as HostInvite;
  if (cur.status !== "active") return { ok: false as const, reason: "not_active" as const, invite: cur };

  // expiry
  if (cur.expiresAtUtc && Date.parse(cur.expiresAtUtc) < Date.now()) {
    return { ok: false as const, reason: "expired" as const, invite: cur };
  }

  if (cur.invitedPhone && String(cur.invitedPhone) !== String(phone)) {
    return { ok: false as const, reason: "phone_mismatch" as const, invite: cur };
  }

  const uses = Array.isArray(cur.uses) ? cur.uses : [];
  if (cur.mode === "single_use" && uses.length > 0) {
    return { ok: false as const, reason: "used" as const, invite: cur };
  }

  const next: HostInvite = {
    ...cur,
    uses: [...uses, { phone: String(phone), usedAtUtc: new Date().toISOString() }],
  };

  list[i] = next;
  saveHostInvites(list);
  return { ok: true as const, invite: next };
}
