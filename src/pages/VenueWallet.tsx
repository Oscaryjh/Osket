import { useMemo } from "react";
import { toast } from "sonner";

import { requireVenueId, loadVenues } from "@/lib/venue-auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function VenueWalletPage() {
  const venueId = requireVenueId();

  const venue = useMemo(() => {
    if (!venueId) return null;
    return loadVenues().find((v) => v.id === venueId) || null;
  }, [venueId]);

  if (!venueId) return <div className="p-6">未登录场地账号</div>;
  if (!venue) return <div className="p-6">找不到场地账号</div>;

  const balance = Number(venue.walletBalanceRm || 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">场地钱包</h1>
        <p className="text-muted-foreground page-subtitle">查看余额与充值记录。充值后将用于平台扣费结算。</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="ledger-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">当前余额</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="font-display text-4xl">RM {balance.toFixed(2)}</div>
            <Badge className="bg-accent text-accent-foreground">本机</Badge>
          </CardContent>
        </Card>

        <Card className="ledger-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">充值</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              目前充值由平台方协助处理（上线版会接 iPay88 自助充值）。
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-primary text-primary-foreground"
                onClick={() => {
                  toast.message("请联系平台进行充值入账");
                }}
              >
                联系平台充值
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.hash = "#/platform-login";
                  toast.message("如你是平台人员，请用平台登入处理充值");
                }}
              >
                去平台登入
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="ledger-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">最近流水</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(venue.walletLedger || []).length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无流水。</div>
          ) : (
            (venue.walletLedger || []).slice(0, 20).map((x) => (
              <div key={x.entryId} className="rounded-lg border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="text-muted-foreground">{x.type} · {x.createdAtUtc}</div>
                  <div className="font-medium">{Number(x.amountRm) >= 0 ? "+" : ""}{Number(x.amountRm).toFixed(2)} RM</div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  余额：RM {Number(x.balanceAfterRm).toFixed(2)}{x.note ? ` · ${x.note}` : ""}
                </div>
              </div>
            ))
          )}
          {(venue.walletLedger || []).length > 20 ? (
            <div className="text-xs text-muted-foreground">仅显示最新 20 条（完整流水请到平台后台导出）。</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
