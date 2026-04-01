import { useMemo, useState } from "react";

import { useProject } from "@/hooks/use-project";
import { requireVenueId } from "@/lib/venue-auth";
import { loadAuditLogs } from "@/lib/audit";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AuditLogPage() {
  const { project } = useProject();
  const venueId = requireVenueId();

  const [banquetId, setBanquetId] = useState<string>(project.activeBanquetId || "all");

  const rows = useMemo(() => {
    if (!venueId) return [];
    return loadAuditLogs()
      .filter((x) => x.venueId === venueId)
      .filter((x) => (banquetId === "all" ? true : x.banquetId === banquetId))
      .slice(0, 200);
  }, [venueId, banquetId]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">操作记录</h1>
        <p className="text-muted-foreground page-subtitle">仅保留最近 180 天（本地版）。</p>
      </header>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">筛选</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[240px_1fr] md:items-end">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">宴会</div>
              <NativeSelect value={banquetId} onChange={(e) => setBanquetId(e.target.value)}>
                <option value="all">全部</option>
                {project.banquets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {(b.event?.date ? `${b.event.date} · ` : "") + (b.event?.name || "(未命名活动)")}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="ledger-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">记录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无记录。</div>
          ) : (
            rows.map((x) => (
              <div key={x.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="text-muted-foreground">
                    {fmt(x.createdAtUtc)} · {x.actorType}
                    {x.banquetId ? ` · banquet=${x.banquetId}` : ""}
                  </div>
                  <Badge variant={x.result === "success" ? "secondary" : "destructive"}>{x.action}</Badge>
                </div>
                {x.reason ? <div className="mt-1 text-xs text-muted-foreground">原因：{x.reason}</div> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
