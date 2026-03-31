import { nanoid } from "nanoid";
import type { Banquet, Guest, ProjectData, Table } from "@/lib/model";

const STORAGE_KEY_BASE = "wedding-ledger.project.v2";
const LEGACY_KEY_BASE = "wedding-ledger.project.v1";

function keyForVenue(base: string, venueId?: string | null) {
  const vid = (venueId || "default").trim() || "default";
  return `${base}.${vid}`;
}

export function deleteProjectForVenue(venueId?: string | null) {
  try {
    localStorage.removeItem(keyForVenue(STORAGE_KEY_BASE, venueId));
    localStorage.removeItem(keyForVenue(LEGACY_KEY_BASE, venueId));
  } catch {
    // ignore
  }
}

function defaultTables(capacity = 10): Table[] {
  // 兼容旧数据/迁移用途：旧版默认会有主桌与 A02
  return [
    { id: "T1", name: "主桌", capacity, locked: true },
    { id: "T2", name: "A02", capacity, locked: false },
  ];
}

function emptyTables(): Table[] {
  // 新版默认：不预设任何桌次，由用户自行新增
  return [];
}

export function defaultProject(): ProjectData {
  const b: Banquet = {
    id: `B_${nanoid(8)}`,
    event: {
      name: "婚礼宴会",
      date: "",
      venue: "",
      defaultTableCapacity: 10,
    },
    groups: ["男方亲友", "女方亲友", "同事"],
    tables: emptyTables(),
    guests: [],
  };

  return {
    version: 2,
    activeBanquetId: b.id,
    banquets: [b],
  };
}

// 旧版 v1 迁移：把 v1 的 event/groups/tables/guests 包成一个 banquet
function migrateV1ToV2(v1: any): ProjectData {
  const id = `B_${nanoid(8)}`;
  const capacity = v1?.event?.defaultTableCapacity || 10;

  return {
    version: 2,
    activeBanquetId: id,
    banquets: [
      {
        id,
        event: {
          name: v1?.event?.name || "婚礼宴会",
          date: v1?.event?.date || "",
          venue: v1?.event?.venue || "",
          defaultTableCapacity: capacity,
        },
        groups: Array.isArray(v1?.groups) ? v1.groups : ["男方亲友", "女方亲友", "同事"],
        tables: Array.isArray(v1?.tables) && v1.tables.length ? v1.tables : defaultTables(capacity),
        guests: Array.isArray(v1?.guests) ? v1.guests : [],
      },
    ],
  };
}

export function loadProject(venueId?: string | null): ProjectData {
  try {
    const raw = localStorage.getItem(keyForVenue(STORAGE_KEY_BASE, venueId));
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectData;
      if (parsed?.version === 2 && Array.isArray(parsed.banquets) && parsed.banquets.length) {
        return parsed;
      }
    }

    // Try migrate legacy v1
    const legacy = localStorage.getItem(keyForVenue(LEGACY_KEY_BASE, venueId));
    if (legacy) {
      const v1 = JSON.parse(legacy);
      const v2 = migrateV1ToV2(v1);
      localStorage.setItem(keyForVenue(STORAGE_KEY_BASE, venueId), JSON.stringify(v2));
      return v2;
    }

    return defaultProject();
  } catch {
    return defaultProject();
  }
}

export function saveProject(project: ProjectData, venueId?: string | null) {
  localStorage.setItem(keyForVenue(STORAGE_KEY_BASE, venueId), JSON.stringify(project));
}

export function nowUtcIso() {
  return new Date().toISOString();
}

export function createGuest(partial: Partial<Guest> & { name: string }): Guest {
  return {
    id: `G_${nanoid(10)}`,
    name: partial.name.trim(),
    phone: partial.phone?.trim() || "",
    group: partial.group || "",
    party: partial.party || "不分",
    isVip: !!partial.isVip,
    tags: partial.tags || [],
    notes: partial.notes || "",
    constraints: partial.constraints || { mustWith: [], mustNotWith: [] },
    assignment: partial.assignment ?? null,
    checkIn: partial.checkIn || { status: "not_checked_in" },
  };
}

export function createBanquet(name = "新的宴会", capacity = 10): Banquet {
  return {
    id: `B_${nanoid(8)}`,
    event: {
      name,
      date: "",
      venue: "",
      defaultTableCapacity: capacity,
    },
    groups: ["男方亲友", "女方亲友", "同事"],
    tables: emptyTables(),
    guests: [],
  };
}
