export type CheckInStatus = "not_checked_in" | "checked_in";

export interface GuestConstraint {
  mustWith: string[];
  mustNotWith: string[];
}

export interface GuestAssignment {
  tableId: string;
  seatNo: number;
}

export interface GuestCheckIn {
  status: CheckInStatus;
  timeUtc?: string; // ISO
}

export type BillingSnapshotStatus = "active" | "voided";
export type BillingPricingModel = "per_checkin_unique";

export interface BillingSnapshot {
  snapshotId: string;
  version: number;
  status: BillingSnapshotStatus;

  venueId?: string; // 本地版可选，云端建议必填
  banquetId: string;

  eventName?: string;
  eventDate?: string;

  lockedAtUtc?: string;
  lockedBy?: string; // platform / venue_owner / userId

  pricingModel: BillingPricingModel;
  rateRmPerHead: number;
  currency: "MYR";
  roundingRule: "round_2dp";

  billableCheckIns: number;
  amountRm: number;

  guestCountTotal?: number;
  guestCountCheckedIn?: number;

  note?: string;

  createdAtUtc: string;
  createdBy: string; // platform / userId

  voidedAtUtc?: string;
  voidedBy?: string;
  voidReason?: string;

  chargedEntryId?: string;
  chargedAtUtc?: string;
  chargedAmountRm?: number;
}

export interface Guest {
  id: string;
  name: string;
  phone?: string;
  group?: string;
  party?: "男方" | "女方" | "不分";
  isVip?: boolean;
  tags?: string[];
  notes?: string;
  constraints?: GuestConstraint;
  assignment?: GuestAssignment | null;
  checkIn?: GuestCheckIn;
}

export interface Table {
  id: string;
  name: string;
  capacity: number;
  locked?: boolean;
}

export interface EventMeta {
  name: string;
  date?: string; // YYYY-MM-DD
  venue?: string;
  defaultTableCapacity: number;

  locked?: boolean; // 活动结束后锁定（禁止改名单/分桌）
  lockedAtUtc?: string;
  lockedBy?: string; // venue_owner / platform

  settlementConfirmed?: boolean; // 确认结算：停止签到（平台才可出最终账单）
  settlementConfirmedAtUtc?: string;
  settlementConfirmedBy?: string; // venue_owner / platform
}

// 单一宴会的数据（隔离名单/桌次/签到）
export interface HostMember {
  phone: string;
  role: "host_admin" | "host_staff";
  addedAtUtc: string;
  addedBy: string; // venue_owner
}

export interface Banquet {
  id: string;
  event: EventMeta;
  groups: string[];
  tables: Table[];
  guests: Guest[];

  billingSnapshots?: BillingSnapshot[]; // 账单快照历史（平台结算用）
  hostMembers?: HostMember[]; // 主办方成员（登入后授权）
}

// v2：一个档案里可有多个宴会
export interface ProjectData {
  version: 2;
  activeBanquetId: string;
  banquets: Banquet[];
}
