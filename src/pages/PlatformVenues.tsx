// 平台：创建场地账号（场地名+手机号），用于本地 Demo
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  createVenueAccount,
  loadVenues,
  saveVenues,
  normalizePhone,
  encodeVenueSeed,
  deleteVenueById,
} from "@/lib/venue-auth";
import { deleteProjectForVenue } from "@/lib/storage";
import { safeCopyText } from "@/lib/clipboard";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function baseUrl() {
  return window.location.origin + window.location.pathname;
}

function loginLink(phone: string, seed?: string) {
  const p = encodeURIComponent(phone);
  // 关键：不要用 hash query（某些环境会被路由初始化“抹掉”）
  // 改用 hash path 参数：#/login/<phone>/<seed>
  if (seed) return `${baseUrl()}#/login/${p}/${encodeURIComponent(seed)}`;
  return `${baseUrl()}#/login/${p}`;
}

export default function PlatformVenuesPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [tick, setTick] = useState(0);

  const venues = useMemo(() => {
    void tick;
    return loadVenues();
  }, [tick]);

  function createVenue() {
    const n = name.trim();
    const p = normalizePhone(phone);
    if (!n) return toast.error("请输入场地名");
    if (!p) return toast.error("请输入手机号");

    const list = loadVenues();
    if (list.some((v) => v.phone === p)) return toast.error("该手机号已存在（请检查是否有空格/符号）");

    const rec = createVenueAccount(n, p);
    saveVenues([rec, ...list]);
    const seed = encodeVenueSeed(rec);
    toast.success("已创建场地账号");
    setName("");
    setPhone("");
    setTick((x) => x + 1);

    void (async () => {
      const ok = await safeCopyText(loginLink(p, seed));
      if (ok) toast.success("已复制登录链接（可跨Tab/跨预览使用，固定OTP：000000）");
    })();
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">平台（本地Demo）</h1>
        <p className="text-muted-foreground page-subtitle">
          这里模拟你作为平台方：创建场地账号（场地名 + 手机号）。场地用手机号登录，固定 OTP 为 000000。
        </p>
      </header>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">新增场地账号</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_240px_auto] md:items-end">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">场地名称</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：Osket Ballroom" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">手机号（登录账号）</div>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="例如：0123456789" />
          </div>
          <Button className="bg-primary text-primary-foreground" onClick={createVenue}>
            创建
          </Button>
        </CardContent>
      </Card>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">已创建的场地</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {venues.length === 0 ? (
            <div className="text-sm text-muted-foreground">还没有场地账号。</div>
          ) : (
            venues.map((v) => (
              <div key={v.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{v.name}</div>
                      <Badge variant="secondary">{v.phone}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground break-all">{loginLink(v.phone, encodeVenueSeed(v))}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void (async () => {
                          const ok = await safeCopyText(loginLink(v.phone, encodeVenueSeed(v)));
                          if (ok) toast.success("已复制登录链接");
                          else toast.error("复制失败：请手动复制");
                        })();
                      }}
                    >
                      复制登录链接
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (!confirm(`确定要删除场地「${v.name}」吗？\n\n将同时清除该场地在本机的活动/来宾/签到数据，且无法恢复。`)) return;
                        deleteVenueById(v.id);
                        deleteProjectForVenue(v.id);
                        toast.success("已删除场地账号");
                        setTick((x) => x + 1);
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
