import { nanoid } from "nanoid";

import type { VenueAccount, WalletLedgerEntry, WalletLedgerType } from "@/lib/venue-auth";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function makeEntry(params: {
  type: WalletLedgerType;
  venueId: string;
  amountRm: number;
  balanceAfterRm: number;
  createdBy: string;
  note?: string;
  banquetId?: string;
  billingSnapshotId?: string;
  billingVersion?: number;
}): WalletLedgerEntry {
  return {
    entryId: `L_${nanoid(10)}`,
    type: params.type,
    venueId: params.venueId,
    amountRm: round2(params.amountRm),
    balanceAfterRm: round2(params.balanceAfterRm),
    createdAtUtc: new Date().toISOString(),
    createdBy: params.createdBy,
    note: params.note,
    banquetId: params.banquetId,
    billingSnapshotId: params.billingSnapshotId,
    billingVersion: params.billingVersion,
  };
}

export function applyWalletEntry(venue: VenueAccount, entry: WalletLedgerEntry): VenueAccount {
  const nextBalance = round2(entry.balanceAfterRm);
  return {
    ...venue,
    walletBalanceRm: nextBalance,
    walletLedger: [entry, ...(venue.walletLedger || [])],
  };
}

export function walletTopup(params: {
  venue: VenueAccount;
  amountRm: number;
  createdBy: string; // platform
  note?: string;
}) {
  const amount = round2(Math.abs(Number(params.amountRm || 0)));
  if (!(amount > 0)) throw new Error("Invalid topup amount");
  const balanceAfter = round2((params.venue.walletBalanceRm || 0) + amount);
  const entry = makeEntry({
    type: "topup",
    venueId: params.venue.id,
    amountRm: amount,
    balanceAfterRm: balanceAfter,
    createdBy: params.createdBy,
    note: params.note,
  });
  return { venue: applyWalletEntry(params.venue, entry), entry };
}

export function walletCharge(params: {
  venue: VenueAccount;
  amountRm: number;
  createdBy: string; // platform
  note?: string;
  banquetId: string;
  billingSnapshotId: string;
  billingVersion: number;
}) {
  const amount = round2(Math.abs(Number(params.amountRm || 0)));
  if (!(amount > 0)) throw new Error("Invalid charge amount");

  // 允许负数余额（你已选策略 B）
  const balanceAfter = round2((params.venue.walletBalanceRm || 0) - amount);
  const entry = makeEntry({
    type: "charge",
    venueId: params.venue.id,
    amountRm: -amount,
    balanceAfterRm: balanceAfter,
    createdBy: params.createdBy,
    note: params.note,
    banquetId: params.banquetId,
    billingSnapshotId: params.billingSnapshotId,
    billingVersion: params.billingVersion,
  });
  return { venue: applyWalletEntry(params.venue, entry), entry };
}

export function walletRefund(params: {
  venue: VenueAccount;
  amountRm: number;
  createdBy: string; // platform
  note?: string;
  banquetId?: string;
  billingSnapshotId?: string;
  billingVersion?: number;
}) {
  const amount = round2(Math.abs(Number(params.amountRm || 0)));
  if (!(amount > 0)) throw new Error("Invalid refund amount");
  const balanceAfter = round2((params.venue.walletBalanceRm || 0) + amount);
  const entry = makeEntry({
    type: "refund",
    venueId: params.venue.id,
    amountRm: amount,
    balanceAfterRm: balanceAfter,
    createdBy: params.createdBy,
    note: params.note,
    banquetId: params.banquetId,
    billingSnapshotId: params.billingSnapshotId,
    billingVersion: params.billingVersion,
  });
  return { venue: applyWalletEntry(params.venue, entry), entry };
}

export function walletAdjust(params: {
  venue: VenueAccount;
  deltaRm: number; // 可正可负
  createdBy: string;
  note?: string;
}) {
  const delta = round2(Number(params.deltaRm || 0));
  if (!delta) throw new Error("Invalid adjustment delta");
  const balanceAfter = round2((params.venue.walletBalanceRm || 0) + delta);
  const entry = makeEntry({
    type: "adjustment",
    venueId: params.venue.id,
    amountRm: delta,
    balanceAfterRm: balanceAfter,
    createdBy: params.createdBy,
    note: params.note,
  });
  return { venue: applyWalletEntry(params.venue, entry), entry };
}

export function findLedgerEntry(venue: VenueAccount, entryId: string) {
  return (venue.walletLedger || []).find((x) => x.entryId === entryId) || null;
}

export function sumLedger(venue: VenueAccount) {
  return round2((venue.walletLedger || []).reduce((acc, x) => acc + (Number(x.amountRm) || 0), 0));
}
