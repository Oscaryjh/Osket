// Design reminder (宴会账本): 现场操作要“大按钮 + 少步骤”，同时要能快速看“谁到了/谁没到”。
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useProject } from "@/hooks/use-project";
import { nowUtcIso } from "@/lib/storage";
import type { Guest } from "@/lib/model";
import { useAuth } from "@/contexts/AuthContext";
import { callRpc, rpcMessageFromError } from "@/lib/rpc";
import { isCloudEnabled } from "@/lib/cloud";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function fmtTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

export default function CheckInPage() {
  const { profile } = useAuth();
  const { activeBanquet: project, updateActiveBanquet } = useProject();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "checked" | "not">("not");

  const checkedInCount = useMemo(
    () => project.guests.filter((g) => g.checkIn?.status === "checked_in").length,
    [project.guests]
  );

  const notArrivedCount = project.guests.length - checkedInCount;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let base = project.guests;
    if (tab === "checked") base = base.filter((g) => g.checkIn?.status === "checked_in");
    if (tab === "not") base = base.filter((g) => g.checkIn?.status !== "checked_in");

    if (!needle) return base;
    return base.filter((g) => {
      return (
        g.name.toLowerCase().includes(needle) ||
        (g.phone || "").toLowerCase().includes(needle) ||
        (g.group || "").toLowerCase().includes(needle)
      );
    });
  }, [project.guests, q, tab]);

  const locked = !!project.event.locked;
  const settlementConfirmed = !!project.event.settlementConfirmed;
  const cloud = isCloudEnabled(profile?.venue_id);

  async function toggle(g: Guest) {
    const isIn = g.checkIn?.status === "checked_in";

    if (settlementConfirmed) {
      return toast.error("已确认结算：停止签到，无法更改签到状态");
    }

    if (locked && isIn) {
      return toast.error("活动已锁定：不允许反签到");
    }

    try {
      if (cloud) {
        if (isIn) {
          await callRpc("cancel_check_in", { p_guest_id: g.id });
        } else {
          await callRpc("check_in", { p_guest_id: g.id });
        }
      }

      updateActiveBanquet((b) => {
        const nextGuests = b.guests.map((x) => {
          if (x.id !== g.id) return x;
          if (isIn) return { ...x, checkIn: { status: "not_checked_in" as const } };
          return { ...x, checkIn: { status: "checked_in" as const, timeUtc: nowUtcIso() } };
        });
        return { ...b, guests: nextGuests };
      });

      toast.success(isIn ? "已取消签到" : "已签到");
    } catch (e: any) {
      toast.error(rpcMessageFromError(e));
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">签到入场</h1>
        <p className="text-muted-foreground">
          这里可以快速查看：谁已签到、谁还没到；也能直接在列表里一键签到/取消。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-accent text-accent-foreground">已签到 {checkedInCount}</Badge>
        <Badge variant="secondary">未到 {notArrivedCount}</Badge>
        <Badge variant="outline">总人数 {project.guests.length}</Badge>
        {settlementConfirmed ? (
          <Badge variant="destructive">已确认结算：停止签到</Badge>
        ) : locked ? (
          <Badge variant="outline">已锁定：不允许反签到</Badge>
        ) : null}
      </div>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">签到列表</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <TabsList>
                <TabsTrigger value="not">未到</TabsTrigger>
                <TabsTrigger value="checked">已签到</TabsTrigger>
                <TabsTrigger value="all">全部</TabsTrigger>
              </TabsList>

              <div className="w-full md:w-[360px]">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜索姓名 / 分组 / 电话"
                />
              </div>
            </div>

            <TabsContent value={tab} className="mt-4">
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">姓名</TableHead>
                      <TableHead>分组</TableHead>
                      <TableHead className="w-[160px]">桌号/座号</TableHead>
                      <TableHead className="w-[110px]">签到时间</TableHead>
                      <TableHead className="w-[140px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          没有符合条件的来宾。
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((g) => {
                        const isIn = g.checkIn?.status === "checked_in";
                        const tableLabel = g.assignment
                          ? `${project.tables.find((t) => t.id === g.assignment?.tableId)?.name || g.assignment.tableId} / ${g.assignment.seatNo}`
                          : "未分桌";
                        return (
                          <TableRow key={g.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <span>{g.name}</span>
                                {isIn ? (
                                  <Badge variant="secondary">已签到</Badge>
                                ) : (
                                  <Badge variant="outline">未到</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{g.group || "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{tableLabel}</TableCell>
                            <TableCell className="text-muted-foreground">{isIn ? fmtTime(g.checkIn?.timeUtc) : "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                disabled={settlementConfirmed || (locked && isIn)}
                                className={
                                  settlementConfirmed || (locked && isIn)
                                    ? "opacity-60"
                                    : isIn
                                      ? "bg-secondary text-secondary-foreground"
                                      : "bg-primary text-primary-foreground"
                                }
                                onClick={() => toggle(g)}
                              >
                                {isIn ? "取消" : "签到"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>

          <div className="text-xs text-muted-foreground leading-relaxed">
            小提示：你也可以先用搜索框找到人，再直接点右边“签到/取消”。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
