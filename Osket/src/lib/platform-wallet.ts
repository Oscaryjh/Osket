import { toast } from "sonner";

import type { VenueAccount } from "@/lib/venue-auth";
import { loadVenues, saveVenues } from "@/lib/venue-auth";
import { walletAdjust, walletTopup } from "@/lib/wallet";

export function updateVenue(venueId: string, updater: (v: VenueAccount) => VenueAccount) {
  const list = loadVenues();
  const i = list.findIndex((v) => v.id === venueId);
  if (i < 0) return false;
  list[i] = updater(list[i]);
  saveVenues(list);
  return true;
}

export function platformTopup(venueId: string, onChanged?: () => void) {
  const amtStr = prompt("充值金额（RM）", "100");
  if (amtStr == null) return;
  const amt = Number(amtStr);
  if (!(amt > 0)) return toast.error("金额不正确");

  const ok = updateVenue(venueId, (v) => walletTopup({ venue: v, amountRm: amt, createdBy: "platform" }).venue);
  if (ok) {
    toast.success("充值成功");
    onChanged?.();
    // 兜底：某些预览环境状态不会立刻刷新
    setTimeout(() => window.location.reload(), 50);
  } else toast.error("找不到场地");
}

export function platformAdjust(venueId: string, onChanged?: () => void) {
  const deltaStr = prompt("调整金额（RM，可正可负）", "-10");
  if (deltaStr == null) return;
  const delta = Number(deltaStr);
  if (!delta) return toast.error("金额不正确");

  const ok = updateVenue(venueId, (v) => walletAdjust({ venue: v, deltaRm: delta, createdBy: "platform" }).venue);
  if (ok) {
    toast.success("调整成功");
    onChanged?.();
    setTimeout(() => window.location.reload(), 50);
  } else toast.error("找不到场地");
}
