import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";

import { loadVenues } from "@/lib/venue-auth";
import { stringifyCsv } from "@/lib/csv";
import { downloadText } from "@/lib/download";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PlatformVenueWalletPage() {
  const [, params] = useRoute("/platform-wallet/:venueId");
  const venueId = params?.venueId || "";
  const [, setLocation] = useLocation();

  const venue = useMemo(() => {
    if (!venueId) return null;
    return loadVenues().find((v) => v.id === venueId) || null;
  }, [venueId]);

  if (!venueId) return <div className="p-6">缺少 venueId</div>;
  if (!venue) return <div className="p-6">找不到该场地</div>;

  const v = venue;
  const ledger = v.walletLedger || [];

  function exportLedgerCsv() {
    const rows = ledger
      .slice()
      .reverse()
      .map((x) => ({
        createdAtUtc: x.createdAtUtc,
        type: x.type,
        amountRm: x.amountRm,
        balanceAfterRm: x.balanceAfterRm,
        createdBy: x.createdBy,
        note: x.note || "",
        banquetId: x.banquetId || "",
        billingSnapshotId: x.billingSnapshotId || "",
        billingVersion: x.billingVersion ?? "",
        entryId: x.entryId,
      }));

    const csv = "\ufeff" + stringifyCsv(rows);
    downloadText(`场地_${v.name}_钱包流水_${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display page-title">钱包流水</h1>
          <p className="text-muted-foreground page-subtitle">
            {v.name}（{v.phone}）
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLocation("/platform-admin")}>返回平台后台</Button>
          <Button className="bg-primary text-primary-foreground" onClick={exportLedgerCsv}>导出CSV</Button>
        </div>
      </header>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">余额</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="font-display text-3xl">RM {(v.walletBalanceRm || 0).toFixed(2)}</div>
          <Badge variant="outline">允许为负</Badge>
        </CardContent>
      </Card>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">流水记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ledger.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无流水。</div>
          ) : (
            ledger.slice(0, 100).map((x) => (
              <div key={x.entryId} className="rounded-xl border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{x.type}</span>
                    <span className="text-muted-foreground"> · {x.createdAtUtc}</span>
                  </div>
                  <div className="text-sm font-medium">{Number(x.amountRm) >= 0 ? "+" : ""}{Number(x.amountRm).toFixed(2)} RM</div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  余额：RM {Number(x.balanceAfterRm).toFixed(2)}
                  {x.note ? ` · ${x.note}` : ""}
                </div>
              </div>
            ))
          )}
          {ledger.length > 100 ? (
            <div className="text-xs text-muted-foreground">仅显示最新 100 条（可导出 CSV 查看完整记录）。</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
