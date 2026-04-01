// 平台方管理页（本地Demo）：查看你创建了多少场地，并集中管理
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

import { useAuth } from "@/contexts/AuthContext";

import { loadVenues } from "@/lib/venue-auth";
import { loadProject } from "@/lib/storage";
import { platformAdjust, platformTopup } from "@/lib/platform-wallet";
import { countBillableCheckIns, calcAmountRm } from "@/lib/billing";
import { loadRateRmPerHead, saveRateRmPerHead } from "@/lib/billing-config";
import { stringifyCsv } from "@/lib/csv";
import { downloadText } from "@/lib/download";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PlatformVenuesPage from "@/pages/PlatformVenues";

export default function PlatformAdminPage() {
  const [, setLocation] = useLocation();
  const { signOut } = useAuth();
  const [tick, setTick] = useState(0);

  const venues = useMemo(() => {
    void tick;
    return loadVenues();
  }, [tick]);

  const formatRateForInput = (n: number) => {
    const s = String(Math.round(n * 100) / 100);
    return s.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  };

  const [rateText, setRateText] = useState(() => formatRateForInput(loadRateRmPerHead(0.5)));

  function saveRate() {
    try {
      const next = saveRateRmPerHead(Number(rateText));
      setRateText(formatRateForInput(next));
      toast.success(`已保存统一费率：RM ${next.toFixed(2)} / 人`);
    } catch {
      toast.error("费率不正确（例如：0.50）");
    }
  }

  function exportBillingCsv() {
    const rate = loadRateRmPerHead(0.5);
    const rows: Record<string, any>[] = [];

    for (const v of venues) {
      const project = loadProject(v.id);
      for (const b of project.banquets) {
        const billable = countBillableCheckIns(b.guests || []);
        const amount = calcAmountRm(billable, rate);
        rows.push({
          venueId: v.id,
          venueName: v.name,
          venuePhone: v.phone,
          banquetId: b.id,
          banquetName: b.event?.name || "(未命名活动)",
          date: b.event?.date || "",
          billableCheckIns: billable,
          rateRmPerHead: rate.toFixed(2),
          amountRm: amount.toFixed(2),
          locked: b.event?.locked ? "yes" : "no",
        });
      }

      if (project.banquets.length === 0) {
        rows.push({
          venueId: v.id,
          venueName: v.name,
          venuePhone: v.phone,
          banquetId: "",
          banquetName: "(无活动)",
          date: "",
          billableCheckIns: 0,
          rateRmPerHead: rate.toFixed(2),
          amountRm: "0.00",
          locked: "",
        });
      }
    }

    const csv = "\ufeff" + stringifyCsv(rows);
    downloadText(
      `平台_所有场地_计费明细_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
    toast.success("已导出计费明细 CSV");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="font-display page-title">平台后台（本地Demo）</h1>
          <Button
            variant="outline"
            onClick={() => {
              void (async () => {
                try {
                  await signOut();
                  toast.success("已登出");
                  setLocation("/platform-login");
                } catch (e: any) {
                  toast.error(e?.message || "登出失败");
                }
              })();
            }}
          >
            登出平台后台
          </Button>
        </div>
        <p className="text-muted-foreground page-subtitle">
          这里给平台方查看/管理已创建的场地账号。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="ledger-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">已创建场地</CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline justify-between">
            <div className="font-display text-3xl">{venues.length}</div>
            <Badge className="bg-accent text-accent-foreground">本机</Badge>
          </CardContent>
        </Card>

        <Card className="ledger-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">计费设置（平台统一）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              统一人头费率（RM/人）。场地端不允许修改，仅平台后台可调整。
            </div>
            <div className="grid gap-2 sm:grid-cols-[220px_1fr] sm:items-end">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">人头费率（RM / 人）</div>
                <Input
                  type="number"
                  step="0.01"
                  min={0.01}
                  value={rateText}
                  onChange={(e) => setRateText(e.target.value)}
                  onBlur={() => {
                    const n = Number(rateText);
                    if (Number.isFinite(n) && n > 0) setRateText(formatRateForInput(n));
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="bg-primary text-primary-foreground" onClick={saveRate}>
                  保存
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRateText("0.5");
                    try {
                      const next = saveRateRmPerHead(0.5);
                      setRateText(formatRateForInput(next));
                      toast.success(`已恢复默认：RM ${next.toFixed(2)} / 人`);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  恢复默认 0.50
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="ledger-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">计费明细报表</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button className="bg-primary text-primary-foreground" onClick={exportBillingCsv}>
              导出所有场地计费明细
            </Button>
            <Button variant="outline" onClick={() => setTick((x) => x + 1)}>
              刷新
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">场地钱包</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {venues.length === 0 ? (
            <div className="text-sm text-muted-foreground">还没有场地账号。</div>
          ) : (
            venues.map((v) => (
              <div key={v.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{v.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">余额：RM {(v.walletBalanceRm || 0).toFixed(2)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground"
                      onClick={() => platformTopup(v.id, () => setTick((x) => x + 1))}
                    >
                      充值
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => platformAdjust(v.id, () => setTick((x) => x + 1))}>
                      调整
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => (window.location.hash = `#/platform-wallet/${v.id}`)}>
                      查看流水
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => (window.location.hash = `#/platform-billing/${v.id}`)}>
                      账单
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 直接嵌入场地账号管理页，平台方更好用 */}
      <div className="rounded-2xl bg-card text-card-foreground ledger-border">
        <div className="p-6 md:p-10">
          <PlatformVenuesPage />
        </div>
      </div>
    </div>
  );
}
