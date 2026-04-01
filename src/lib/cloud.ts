import type { Banquet, Guest, ProjectData, Table } from "@/lib/model";
import { supabase } from "@/lib/supabase";

function isUuid(s?: string | null) {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function isCloudEnabled(venueId?: string | null) {
  return isUuid(venueId) && !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export async function cloudLoadProject(venueId: string): Promise<ProjectData> {
  const { data: banquets, error: bErr } = await supabase
    .from("banquets")
    .select("id, venue_id, name, date, location, status, locked_at, locked_by_user_id, settlement_confirmed_at, settlement_confirmed_by_user_id")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });
  if (bErr) throw bErr;

  const mapped: Banquet[] = [];
  for (const b of banquets || []) {
    const { data: guests, error: gErr } = await supabase
      .from("guests")
      .select("id,name,phone,group,notes,tags,table_id,seat_no,check_in_status,check_in_time")
      .eq("banquet_id", b.id)
      .order("created_at", { ascending: true });
    if (gErr) throw gErr;

    const gs: Guest[] = (guests || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      phone: g.phone || undefined,
      group: g.group || undefined,
      notes: g.notes || undefined,
      tags: Array.isArray(g.tags) ? g.tags : undefined,
      assignment: g.table_id
        ? { tableId: String(g.table_id), seatNo: Number(g.seat_no || 0) || 0 }
        : null,
      checkIn:
        g.check_in_status === "checked_in"
          ? { status: "checked_in", timeUtc: g.check_in_time || undefined }
          : { status: "not_checked_in" },
    }));

    const groups = Array.from(new Set(gs.map((x) => x.group).filter(Boolean) as string[]));

    mapped.push({
      id: b.id,
      event: {
        name: b.name,
        date: b.date || undefined,
        venue: b.location || undefined,
        defaultTableCapacity: 10,
        locked: b.status !== "active",
        lockedAtUtc: b.locked_at || undefined,
        lockedBy: b.locked_by_user_id || undefined,
        settlementConfirmed: b.status === "settlement_confirmed",
        settlementConfirmedAtUtc: b.settlement_confirmed_at || undefined,
        settlementConfirmedBy: b.settlement_confirmed_by_user_id || undefined,
      },
      groups,
      tables: [] as Table[],
      guests: gs,
    });
  }

  return {
    version: 2,
    activeBanquetId: mapped[0]?.id || "",
    banquets: mapped,
  };
}

export async function cloudReloadBanquet(venueId: string, banquetId: string) {
  const p = await cloudLoadProject(venueId);
  const b = p.banquets.find((x) => x.id === banquetId);
  return { project: p, banquet: b || null };
}
