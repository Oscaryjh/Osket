import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";

import { loadVenues, saveVenues } from "@/lib/venue-auth";
import { loadProject, saveProject } from "@/lib/storage";
import { loadRateRmPerHead } from "@/lib/billing-config";
import { createBillingSnapshot, getActiveBillingSnapshot, voidActiveBillingSnapshot } from "@/lib/billing-snapshot";
import { walletCharge, walletRefund } from "@/lib/wallet";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function findVenue(venueId: string) {
  const list = loadVenues();
  return { venue: list.find((v) => v.id === venueId) || null, list };
}

export default function PlatformVenueBilling() {
  const [, params] = useRoute("/platform-billing/:venueId");
  const venueId = params?.venueId || "";
  const [, setLocation] = useLocation();
  const [tick, setTick] = useState(0);

  const { venue, list } = useMemo(() => {
    void tick;
    return findVenue(venueId);
  }, [tick, venueId]);

  const project = useMemo(() => {
    void tick;
    return loadProject(venueId);
  }, [tick, venueId]);

  const rate = useMemo(() => loadRateRmPerHead(0.5), []);

  if (!venueId) return <div className="p-6">缺少 venueId</div>;
  if (!venue) return <div className="p-6">找不到该场地</div>;

  function updateVenue(updater: (v: any) => any) {
    const i = list.findIndex((x) => x.id === venueId);
    if (i < 0) return false;
    list[i] = updater(list[i]);
    saveVenues(list);
    return true;
  }

  function updateProjectBanquet(banquetId: string, updater: (b: any) => any) {
    const next = {
      ...project,
      banquets: project.banquets.map((b) => (b.id === banquetId ? updater(b) : b)),
    };
    saveProject(next, venueId);
    setTick((x) => x + 1);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display page-title">场地账单管理</h1>
          <p className="text-muted-foreground page-subtitle">{venue.name}（{venue.phone}）</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLocation("/platform-admin")}>
            返回平台后台
          </Button>
        </div>
      </header>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">活动列表（按活动）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.banquets.map((b) => {
            const active = getActiveBillingSnapshot(b);
            const charged = !!active?.chargedEntryId;
            const locked = !!b.event?.locked;
            return (
              <div key={b.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{b.event?.name || "(未命名活动)"}</div>
                      <Badge variant={locked ? "default" : "secondary"}>{locked ? "已锁定" : "未锁定"}</Badge>
                      {active ? <Badge variant="outline">v{active.version}</Badge> : <Badge variant="outline">未出账</Badge>}
                      {charged ? <Badge className="bg-accent text-accent-foreground">已扣费</Badge> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      日期：{b.event?.date || "-"}；当前余额：RM {(venue.walletBalanceRm || 0).toFixed(2)}
                    </div>
                    {active ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        快照：billable={active.billableCheckIns}，rate=RM {active.rateRmPerHead.toFixed(2)}，amount=RM {active.amountRm.toFixed(2)}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground"
                      disabled={!locked}
                      onClick={() => {
                        if (!locked) return;
                        updateProjectBanquet(b.id, (bb: any) => {
                          const res = createBillingSnapshot({ banquet: bb, venueId, rateRmPerHead: rate, createdBy: "platform" });
                          return { ...bb, billingSnapshots: res.billingSnapshots };
                        });
                        toast.success("已生成/更新账单快照");
                      }}
                    >
                      生成/重算账单
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!active}
                      onClick={() => {
                        const reason = prompt("作废原因", "作废") || "作废";
                        updateProjectBanquet(b.id, (bb: any) => {
                          const res = voidActiveBillingSnapshot({ banquet: bb, voidReason: reason, voidedBy: "platform" });
                          return { ...bb, billingSnapshots: res.billingSnapshots };
                        });
                        toast.success("已作废当前账单版本");
                      }}
                    >
                      作废当前版本
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!active || charged}
                      onClick={() => {
                        if (!active) return;
                        updateVenue((vv: any) => {
                          const c = walletCharge({
                            venue: vv,
                            amountRm: active.amountRm,
                            createdBy: "platform",
                            note: `banquet=${b.id} v${active.version}`,
                            banquetId: b.id,
                            billingSnapshotId: active.snapshotId,
                            billingVersion: active.version,
                          });
                          // also mark snapshot charged in project
                          updateProjectBanquet(b.id, (bb: any) => {
                            const list2 = (bb.billingSnapshots || []).map((s: any) =>
                              s.snapshotId === active.snapshotId
                                ? { ...s, chargedEntryId: c.entry.entryId, chargedAtUtc: new Date().toISOString(), chargedAmountRm: c.entry.amountRm }
                                : s
                            );
                            return { ...bb, billingSnapshots: list2 };
                          });
                          return c.venue;
                        });
                        toast.success("已扣费（允许余额为负）");
                        setTick((x) => x + 1);
                      }}
                    >
                      扣费
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!active || !charged}
                      onClick={() => {
                        if (!active || !active.chargedAmountRm) return;
                        const reason = prompt("回滚原因", "回滚") || "回滚";
                        updateVenue((vv: any) => {
                          const r = walletRefund({
                            venue: vv,
                            amountRm: Math.abs(active.chargedAmountRm || 0),
                            createdBy: "platform",
                            note: `refund ${reason}`,
                            banquetId: b.id,
                            billingSnapshotId: active.snapshotId,
                            billingVersion: active.version,
                          });
                          updateProjectBanquet(b.id, (bb: any) => {
                            const list2 = (bb.billingSnapshots || []).map((s: any) =>
                              s.snapshotId === active.snapshotId ? { ...s, chargedEntryId: undefined, chargedAtUtc: undefined, chargedAmountRm: undefined } : s
                            );
                            return { ...bb, billingSnapshots: list2 };
                          });
                          return r.venue;
                        });
                        toast.success("已回滚扣费");
                        setTick((x) => x + 1);
                      }}
                    >
                      回滚扣费
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
