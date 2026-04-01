// 接待台模式：专为平板设计（大字号、少步骤、快速确认座位+签到）
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useProject } from "@/hooks/use-project";
import { nowUtcIso } from "@/lib/storage";
import type { Guest } from "@/lib/model";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function tableLabel(tables: { id: string; name: string }[], g: Guest) {
  if (!g.assignment) return "未分桌";
  const name = tables.find((t) => t.id === g.assignment?.tableId)?.name || g.assignment.tableId;
  // 依你的需求：只显示桌号，不显示“几号座”。
  return `${name}桌`;
}

function normalize(s: string) {
  return (s || "").trim().toLowerCase();
}

export default function KioskCheckIn() {
  const { activeBanquet: project, updateActiveBanquet } = useProject();
  const [q, setQ] = useState("");
  const [success, setSuccess] = useState<
    | null
    | {
        name: string;
        seat: string;
      }
  >(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // auto focus on enter
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

  const stats = useMemo(() => {
    const total = project.guests.length;
    const checked = project.guests.filter((g) => g.checkIn?.status === "checked_in").length;
    return { total, checked, notArrived: total - checked };
  }, [project.guests]);

  const results = useMemo(() => {
    const needle = normalize(q);
    if (!needle) return [] as Guest[];

    // default show 未到优先
    const notArrived = project.guests.filter((g) => g.checkIn?.status !== "checked_in");
    const arrived = project.guests.filter((g) => g.checkIn?.status === "checked_in");
    const base = [...notArrived, ...arrived];

    const list = base.filter((g) => {
      const name = normalize(g.name);
      const phone = normalize(g.phone || "");
      const group = normalize(g.group || "");
      // allow last4
      const last4 = phone.length >= 4 ? phone.slice(-4) : "";

      if (name.includes(needle)) return true;
      if (phone.includes(needle)) return true;
      if (group.includes(needle)) return true;
      if (needle.length === 4 && last4 === needle) return true;
      return false;
    });

    return list.slice(0, 20);
  }, [project.guests, q]);

  function setCheckedIn(id: string, next: boolean) {
    updateActiveBanquet((b) => {
      const guests = b.guests.map((g) => {
        if (g.id !== id) return g;
        if (!next) return { ...g, checkIn: { status: "not_checked_in" as const } };
        return { ...g, checkIn: { status: "checked_in" as const, timeUtc: nowUtcIso() } };
      });
      return { ...b, guests };
    });
  }

  function quickCheckIn(g: Guest) {
    const isIn = g.checkIn?.status === "checked_in";
    setCheckedIn(g.id, !isIn);

    if (!isIn) {
      const seat = tableLabel(project.tables, g);
      setSuccess({ name: g.name, seat });
      window.setTimeout(() => setSuccess(null), 1400);

      toast.success(`已签到：${g.name}`);
      setQ("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      toast.success(`已取消：${g.name}`);
    }
  }

  function requestFullscreen() {
    const el: any = document.documentElement as any;
    const fs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!fs) return;

    try {
      const ret = fs.call(el);
      // Modern browsers return a Promise; some preview environments block it via Permissions-Policy.
      if (ret && typeof ret.then === "function") {
        void ret.catch(() => toast.error("此环境不允许全屏（Permissions Policy）"));
      }
    } catch {
      toast.error("此环境不允许全屏（Permissions Policy）");
    }
  }

  return (
    <div className="space-y-6">
      {success ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-primary/90 text-primary-foreground">
          <div className="mx-6 w-full max-w-3xl rounded-3xl bg-background/10 p-10 text-center ledger-border">
            <div className="font-display text-6xl tracking-tight">签到成功</div>
            <div className="mt-6 text-4xl font-semibold">{success.name}</div>
            <div className="mt-3 text-2xl opacity-90">{success.seat}</div>
            <div className="mt-6 text-base opacity-80">请前往对应桌位入座</div>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display page-title">接待台模式</h1>
          <div className="text-sm text-muted-foreground">
            平板用：输入姓名/电话后4位 → 立即显示桌号座号 → 一键签到
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-accent text-accent-foreground">已签到 {stats.checked}</Badge>
          <Badge variant="secondary">未到 {stats.notArrived}</Badge>
          <Badge variant="outline">总人数 {stats.total}</Badge>
          <Button variant="outline" onClick={requestFullscreen}>全屏</Button>
        </div>
      </div>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">快速查找</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="输入姓名 / 电话 / 后4位"
            className="h-14 text-xl"
          />

          {q.trim() === "" ? (
            <div className="text-sm text-muted-foreground">
              提示：现场建议让工作人员只做“搜索→确认→签到”，不要翻纸本名单。
            </div>
          ) : results.length === 0 ? (
            <div className="text-sm text-muted-foreground">找不到匹配。</div>
          ) : (
            <div className="grid gap-3">
              {results.map((g) => {
                const isIn = g.checkIn?.status === "checked_in";
                return (
                  <div
                    key={g.id}
                    className="rounded-2xl border border-border bg-background p-4 md:p-5"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-2xl font-semibold">{g.name}</div>
                          {isIn ? (
                            <Badge variant="secondary">已签到</Badge>
                          ) : (
                            <Badge variant="outline">未到</Badge>
                          )}
                          {g.isVip ? (
                            <Badge className="bg-accent text-accent-foreground">VIP</Badge>
                          ) : null}
                        </div>
                        <div className="mt-1 space-y-1">
                          <div className="text-2xl font-semibold tracking-tight text-foreground">
                            {tableLabel(project.tables, g)}
                          </div>
                          {g.group ? (
                            <div className="text-base text-muted-foreground">分组：{g.group}</div>
                          ) : null}
                          {g.phone ? (
                            <div className="text-base text-muted-foreground">手机号：{g.phone}</div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className={
                            isIn
                              ? "h-12 px-6 bg-secondary text-secondary-foreground"
                              : "h-12 px-6 bg-primary text-primary-foreground"
                          }
                          onClick={() => quickCheckIn(g)}
                        >
                          {isIn ? "取消" : "签到"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-xs text-muted-foreground leading-relaxed">
            小技巧：同名时可用电话后4位输入；点“签到”后会自动清空输入框，方便连续处理下一位。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
