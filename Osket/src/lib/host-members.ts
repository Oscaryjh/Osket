import type { HostRole } from "@/lib/host-auth";
import { loadProject, saveProject } from "@/lib/storage";

export function addHostMember(params: {
  venueId: string;
  banquetId: string;
  phone: string;
  role: HostRole;
  addedBy?: string;
}) {
  const p = loadProject(params.venueId);
  const banquets = p.banquets.map((b) => {
    if (b.id !== params.banquetId) return b;
    const list = Array.isArray(b.hostMembers) ? b.hostMembers : [];
    const normalizedPhone = String(params.phone || "").trim();
    const exists = list.some((m) => m.phone === normalizedPhone);
    const nextList = exists
      ? list.map((m) => (m.phone === normalizedPhone ? { ...m, role: params.role } : m))
      : [...list, { phone: normalizedPhone, role: params.role, addedAtUtc: new Date().toISOString(), addedBy: params.addedBy || "venue_owner" }];
    return { ...b, hostMembers: nextList };
  });
  const next = { ...p, banquets };
  saveProject(next, params.venueId);
  return true;
}

export function removeHostMember(params: { venueId: string; banquetId: string; phone: string }) {
  const p = loadProject(params.venueId);
  const banquets = p.banquets.map((b) => {
    if (b.id !== params.banquetId) return b;
    const list = Array.isArray(b.hostMembers) ? b.hostMembers : [];
    const nextList = list.filter((m) => m.phone !== String(params.phone || "").trim());
    return { ...b, hostMembers: nextList };
  });
  const next = { ...p, banquets };
  saveProject(next, params.venueId);
  return true;
}

export function isHostMember(params: { venueId: string; banquetId: string; phone: string }) {
  const p = loadProject(params.venueId);
  const b = p.banquets.find((x) => x.id === params.banquetId);
  const list = (b?.hostMembers || []) as any[];
  return list.some((m) => m.phone === String(params.phone || "").trim());
}
