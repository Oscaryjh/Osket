import type { Banquet, Guest, Table } from "@/lib/model";

export function unassignedGuests(project: Banquet) {
  return project.guests.filter((g) => !g.assignment);
}

export function guestsByTable(project: Banquet, tableId: string) {
  return project.guests
    .filter((g) => g.assignment?.tableId === tableId)
    .sort((a, b) => (a.assignment?.seatNo ?? 0) - (b.assignment?.seatNo ?? 0));
}

export function nextEmptySeat(table: Table, seated: Guest[]) {
  const taken = new Set(seated.map((g) => g.assignment?.seatNo).filter(Boolean) as number[]);
  for (let i = 1; i <= table.capacity; i++) {
    if (!taken.has(i)) return i;
  }
  return null;
}

export function assignToTable(project: Banquet, guestId: string, tableId: string) {
  const table = project.tables.find((t) => t.id === tableId);
  if (!table) return project;
  const seated = guestsByTable(project, tableId);
  const seatNo = nextEmptySeat(table, seated);
  if (!seatNo) return project;

  return {
    ...project,
    guests: project.guests.map((g) =>
      g.id === guestId ? { ...g, assignment: { tableId, seatNo } } : g
    ),
  };
}

export function unassign(project: Banquet, guestId: string) {
  return {
    ...project,
    guests: project.guests.map((g) => (g.id === guestId ? { ...g, assignment: null } : g)),
  };
}

// --- Rule-based auto seating ---
// Priority:
// 1) locked tables keep existing assignments (no moving)
// 2) VIP first, then group clustering
export function autoSeat(project: Banquet) {
  const tables = project.tables;
  if (!tables.length) return project;

  const lockedIds = new Set(tables.filter((t) => t.locked).map((t) => t.id));

  // keep all locked assignments + any already assigned to locked tables
  const fixedGuestIds = new Set(
    project.guests
      .filter((g) => g.assignment && lockedIds.has(g.assignment.tableId))
      .map((g) => g.id)
  );

  // clear non-locked assignments
  let next: Banquet = {
    ...project,
    guests: project.guests.map((g) => {
      if (!g.assignment) return g;
      if (fixedGuestIds.has(g.id)) return g;
      return { ...g, assignment: null };
    }),
  };

  const candidates = next.guests.filter((g) => !g.assignment);

  // group buckets
  const vip = candidates.filter((g) => g.isVip);
  const nonVip = candidates.filter((g) => !g.isVip);

  const byGroup = new Map<string, Guest[]>();
  for (const g of nonVip) {
    const key = (g.group || "").trim() || "（未分组）";
    const arr = byGroup.get(key) || [];
    arr.push(g);
    byGroup.set(key, arr);
  }

  const queue: Guest[] = [];
  queue.push(...vip);
  for (const [, arr] of [...byGroup.entries()].sort((a, b) => b[1].length - a[1].length)) {
    queue.push(...arr);
  }

  for (const table of tables) {
    while (true) {
      const seatedNow = guestsByTable(next, table.id);
      const seatNo = nextEmptySeat(table, seatedNow);
      if (!seatNo) break;
      const g = queue.shift();
      if (!g) break;
      next = {
        ...next,
        guests: next.guests.map((x) =>
          x.id === g.id ? { ...x, assignment: { tableId: table.id, seatNo } } : x
        ),
      };
    }
    if (!queue.length) break;
  }

  return next;
}
