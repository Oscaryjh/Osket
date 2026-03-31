import { nanoid } from "nanoid";
import type { Banquet, BillingSnapshot } from "@/lib/model";
import { countBillableCheckIns, calcAmountRm } from "@/lib/billing";

export function getActiveBillingSnapshot(b: Banquet) {
  const list = b.billingSnapshots || [];
  return list
    .filter((s) => s.status === "active")
    .sort((a, c) => c.version - a.version)[0] as BillingSnapshot | undefined;
}

export function createBillingSnapshot(params: {
  banquet: Banquet;
  venueId?: string;
  rateRmPerHead: number;
  createdBy: string; // platform
  note?: string;
}) {
  const { banquet, venueId, rateRmPerHead, createdBy, note } = params;

  const prevActive = getActiveBillingSnapshot(banquet);
  const nextVersion = (prevActive?.version || 0) + 1;

  const billable = countBillableCheckIns(banquet.guests || []);
  const amount = calcAmountRm(billable, rateRmPerHead);

  const snapshot: BillingSnapshot = {
    snapshotId: `S_${nanoid(10)}`,
    version: nextVersion,
    status: "active",

    venueId,
    banquetId: banquet.id,

    eventName: banquet.event?.name,
    eventDate: banquet.event?.date,

    lockedAtUtc: banquet.event?.lockedAtUtc,
    lockedBy: banquet.event?.lockedBy,

    pricingModel: "per_checkin_unique",
    rateRmPerHead,
    currency: "MYR",
    roundingRule: "round_2dp",

    billableCheckIns: billable,
    amountRm: amount,

    guestCountTotal: (banquet.guests || []).length,
    guestCountCheckedIn: billable,

    note,

    createdAtUtc: new Date().toISOString(),
    createdBy,
  };

  // keep history, ensure only one active
  const old = banquet.billingSnapshots || [];
  const nextList: BillingSnapshot[] = old.map((s) => (s.status === "active" ? { ...s, status: "voided", voidedAtUtc: new Date().toISOString(), voidedBy: createdBy, voidReason: "recalc" } : s));
  nextList.push(snapshot);

  return { snapshot, billingSnapshots: nextList };
}

export function voidActiveBillingSnapshot(params: {
  banquet: Banquet;
  voidReason: string;
  voidedBy: string;
}) {
  const { banquet, voidReason, voidedBy } = params;
  const old = banquet.billingSnapshots || [];
  const active = getActiveBillingSnapshot(banquet);
  if (!active) return { billingSnapshots: old };

  const now = new Date().toISOString();
  const next = old.map((s) =>
    s.snapshotId === active.snapshotId
      ? {
          ...s,
          status: "voided" as const,
          voidedAtUtc: now,
          voidedBy,
          voidReason: voidReason || "voided",
        }
      : s
  );

  return { billingSnapshots: next };
}
