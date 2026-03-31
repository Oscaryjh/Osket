// Design reminder (宴会账本): 设置像"封面信息"与"备份保险"。
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useProject } from "@/hooks/use-project";
import { useAuth } from "@/contexts/AuthContext";
import { defaultProject } from "@/lib/storage";
import type { ProjectData } from "@/lib/model";
import { loadProject } from "@/lib/storage";
import { requireVenueId } from "@/lib/venue-auth";
import { downloadText } from "@/lib/download";
import { stringifyCsv, guestsToCsvRows } from "@/lib/csv";
import { loadLotteryWinners } from "@/lib/lottery";
import { loadAdminPin, saveAdminPin } from "@/lib/admin-pin";
import { callRpc, rpcMessageFromError } from "@/lib/rpc";
import { isCloudEnabled } from "@/lib/cloud";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { safeCopyText } from "@/lib/clipboard";

const LOCK_KEY = "wedding-ledger.kioskLocked";
const PIN_KEY = "wedding-ledger.kioskPin";

export default function SettingsPage() {
  const { profile } = useAuth();
  const { activeBanquet: banquet, updateActiveBanquet } = useProject();

  const project = banquet;
  const setProject = (b: any) => updateActiveBanquet(() => b);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(project.event.name);
  const [date, setDate] = useState(project.event.date || "");
  const [venue, setVenue] = useState(project.event.venue || "");
  const [cap, setCap] = useState(project.event.defaultTableCapacity || 10);

  const locked = !!project.event.locked;
  const settlementConfirmed = !!project.event.settlementConfirmed;
  const cloud = isCloudEnabled(profile?.venue_id);

  // Supabase banquet_id：本地 demo 的 id 可能不同。
  // 这里先提供一个输入框/或以后从“活动绑定”获得。
  const banquetId = project.id;

  const [kioskPin, setKioskPin] = useState(() => localStorage.getItem(PIN_KEY) || "0000");

  const [adminPin, setAdminPin] = useState(() => loadAdminPin("0000"));
  const [adminOtp, setAdminOtp] = useState("000000");
  const [newAdminPin, setNewAdminPin] = useState("");

  function saveAdminPinNow() {
    try {
      const next = saveAdminPin(adminPin);
      setAdminPin(next);
      toast.success("已保存管理员 PIN");
    } catch {
      toast.error("管理员 PIN 需为 4-8 位数字");
    }
  }

  function resetAdminPinByOtp() {
    if (String(adminOtp).trim() !== "000000") return toast.error("OTP 不正确（测试版固定 000000）");
    if (!newAdminPin.trim()) return toast.error("请输入新的管理员 PIN");
    try {
      const next = saveAdminPin(newAdminPin);
      setAdminPin(next);
      setNewAdminPin("");
      toast.success("已重置管理员 PIN");
    } catch {
      toast.error("管理员 PIN 需为 4-8 位数字");
    }
  }
  const [hostPhone, setHostPhone] = useState("");
  const [inviteExpiryDays, setInviteExpiryDays] = useState<number>(30);
  const [showInactiveInvites, setShowInactiveInvites] = useState(false);
  const [tick, setTick] = useState(0);

  function saveKioskPin() {
    const next = kioskPin.trim() || "0000";
    localStorage.setItem(PIN_KEY, next);
    toast.success("已保存接待台 PIN");
  }

  function resetKioskPin() {
    if (!confirm("确定要把接待台解锁 PIN 重置为 0000 吗？")) return;
    localStorage.setItem(PIN_KEY, "0000");
    setKioskPin("0000");
    toast.success("已重置 PIN 为 0000");
  }

  function forceUnlockKiosk() {
    if (!confirm("确定要解除接待台锁定吗？")) return;
    localStorage.setItem(LOCK_KEY, "0");
    toast.success("已解除锁定");
  }

  function kioskLockLink() {
    return window.location.origin + window.location.pathname + "#/kiosk-lock";
  }

  function saveMeta() {
    if (locked) return toast.error("活动已锁定，无法修改活动信息");
    setProject({
      ...project,
      event: {
        ...project.event,
        name: name.trim() || "婚礼宴会",
        date,
        venue,
        defaultTableCapacity: Math.max(1, Math.min(30, Math.floor(cap || 10))),
      },
    });
    toast.success("已保存设置");
  }

  async function lockEvent() {
    if (locked) return;
    if (!confirm("确定要结束活动并锁定吗？锁定后将禁止修改名单/分桌，但仍可继续签到与打印。")) return;

    try {
      if (cloud) await callRpc("lock_event", { p_banquet_id: banquetId });
      toast.success("活动已锁定");

      // UI 立即响应（本地状态）。后续会改成从 Supabase 拉取状态。
      setProject({
        ...project,
        event: {
          ...project.event,
          locked: true,
          lockedAtUtc: new Date().toISOString(),
          lockedBy: "venue_owner",
        },
      });
    } catch (e: any) {
      toast.error(rpcMessageFromError(e));
    }
  }

  async function unlockEvent() {
    if (!locked) return;
    const pin = prompt("请输入管理员 PIN");
    if (pin == null) return;
    const reason = prompt("请输入解除锁定原因（必填）");
    if (!reason || !reason.trim()) return toast.error("解除锁定原因必填");
    if (!confirm("确定要解除锁定吗？解除后可再次修改名单与分桌。")) return;

    try {
      if (cloud) await callRpc("unlock_event", { p_banquet_id: banquetId, p_admin_pin: pin, p_reason: reason.trim() });
      toast.success("已解除锁定");

      setProject({
        ...project,
        event: {
          ...project.event,
          locked: false,
          lockedAtUtc: undefined,
          lockedBy: undefined,
          settlementConfirmed: false,
          settlementConfirmedAtUtc: undefined,
          settlementConfirmedBy: undefined,
        },
      });
    } catch (e: any) {
      toast.error(rpcMessageFromError(e));
    }
  }

  async function confirmSettlement() {
    if (!locked) return toast.error("请先结束活动并锁定");
    if (settlementConfirmed) return;
    if (!confirm("确定要确认结算并停止签到吗？确认后将无法再签到，平台才可出最终账单并扣费。")) return;

    try {
      if (cloud) await callRpc("confirm_settlement", { p_banquet_id: banquetId });
      toast.success("已确认结算：停止签到");

      setProject({
        ...project,
        event: {
          ...project.event,
          settlementConfirmed: true,
          settlementConfirmedAtUtc: new Date().toISOString(),
          settlementConfirmedBy: "venue_owner",
        },
      });
    } catch (e: any) {
      toast.error(rpcMessageFromError(e));
    }
  }

  async function revokeSettlement() {
    if (!settlementConfirmed) return;
    const pin = prompt("请输入管理员 PIN");
    if (pin == null) return;
    const reason = prompt("请输入撤销确认结算原因（必填）");
    if (!reason || !reason.trim()) return toast.error("撤销原因必填");
    if (!confirm("确定要撤销确认结算并重新开放签到吗？")) return;

    try {
      if (cloud) await callRpc("revoke_settlement", { p_banquet_id: banquetId, p_admin_pin: pin, p_reason: reason.trim() });
      toast.success("已撤销确认结算");

      setProject({
        ...project,
        event: {
          ...project.event,
          settlementConfirmed: false,
          settlementConfirmedAtUtc: undefined,
          settlementConfirmedBy: undefined,
        },
      });
    } catch (e: any) {
      toast.error(rpcMessageFromError(e));
    }
  }

  function exportBackup() {
    const full = loadProject(requireVenueId());
    downloadText(
      `婚礼座位系统_备份_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(full, null, 2),
      "application/json;charset=utf-8"
    );
    toast.success("已导出备份 JSON");
  }

  function exportGuestsCsv() {
    const rows = guestsToCsvRows(project.guests, (tableId) => {
      return project.tables.find((t) => t.id === tableId)?.name || tableId;
    });
    const csv = "\ufeff" + stringifyCsv(rows);
    downloadText(
      `${project.event.name || "活动"}_guests_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
    toast.success("已导出 guests.csv");
  }

  function exportTablesCsv() {
    const rows = project.tables.map((t) => ({
      tableId: t.id,
      tableName: t.name,
      capacity: t.capacity,
      locked: t.locked ? "yes" : "no",
    }));
    const csv = "\ufeff" + stringifyCsv(rows);
    downloadText(
      `${project.event.name || "活动"}_tables_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
    toast.success("已导出 tables.csv");
  }

  function exportLotteryCsv() {
    const winners = loadLotteryWinners(project.id);
    const rows = winners.map((w) => ({
      name: w.name,
      timeUtc: w.timeUtc,
      timeLocal: new Date(w.timeUtc).toLocaleString(),
    }));
    const csv = "\ufeff" + stringifyCsv(rows);
    downloadText(
      `${project.event.name || "活动"}_lottery_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
    toast.success("已导出 lottery.csv");
  }

  async function importBackup(file: File) {
    const tid = toast.loading("正在导入备份…");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ProjectData;
      if (!parsed || parsed.version !== 2) {
        toast.error("备份格式不正确（version 不是 2）", { id: tid });
        return;
      }
      // 导入的是全项目（多宴会），直接覆写
      localStorage.setItem("wedding-ledger.project.v2", JSON.stringify(parsed));
      window.location.reload();
      toast.success("导入完成（页面将刷新）", { id: tid });
    } catch (e: any) {
      toast.error(`导入失败：${e?.message || "未知错误"}`, { id: tid });
    }
  }

  function resetAll() {
    if (!confirm("确定要清空所有数据吗？此操作不可撤销。建议先导出备份 JSON。")) return;
    setProject(defaultProject());
    toast.success("已清空并重置");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">设置</h1>
        <p className="text-muted-foreground page-subtitle">
          这是本地版系统：请把“导出备份 JSON”当成你的保险。
        </p>
      </header>

      <Card className="ledger-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">活动信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">活动名称</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">日期</div>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="text-sm text-muted-foreground">地点</div>
            <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">默认每桌人数</div>
            <Input type="number" min={1} max={30} value={cap} onChange={(e) => setCap(Number(e.target.value))} />
          </div>
          <div className="flex items-end">
            <Button className="bg-primary text-primary-foreground" onClick={saveMeta} disabled={locked}>
              保存设置
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="ledger-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">活动状态</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            第 1 步：结束活动并锁定（冻结资料）。第 2 步：确认结算（停止签到，平台才可出最终账单）。
          </div>

          <div className="flex flex-wrap gap-2">
            {!locked ? (
              <Button className="bg-primary text-primary-foreground" onClick={lockEvent}>
                结束活动并锁定（冻结资料）
              </Button>
            ) : (
              <Button variant="outline" onClick={unlockEvent}>
                解除锁定（管理员 PIN + 原因）
              </Button>
            )}

            <Button
              variant={settlementConfirmed ? "outline" : "default"}
              className={!locked ? "opacity-60" : settlementConfirmed ? "" : "bg-primary text-primary-foreground"}
              disabled={!locked || settlementConfirmed}
              onClick={confirmSettlement}
            >
              确认结算（停止签到）
            </Button>

            <Button variant="outline" disabled={!settlementConfirmed} onClick={revokeSettlement}>
              撤销确认结算（管理员 PIN + 原因）
            </Button>

            {settlementConfirmed ? (
              <Badge className="bg-accent text-accent-foreground">已确认结算</Badge>
            ) : locked ? (
              <Badge className="bg-accent text-accent-foreground">已锁定</Badge>
            ) : (
              <Badge variant="secondary">进行中</Badge>
            )}
          </div>

          {locked ? (
            <div className="text-xs text-muted-foreground">
              已锁定：名单/分桌冻结；签到只允许“签到”，不允许反签到。
            </div>
          ) : null}
          {settlementConfirmed ? (
            <div className="text-xs text-muted-foreground">已确认结算：停止签到；如需更正请撤销确认结算（管理员 PIN）。</div>
          ) : null}
        </CardContent>
      </Card>


      <Card className="ledger-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">管理员 PIN（独立）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            用于高风险操作二次验证：解除锁定、撤销确认结算等（与接待台 PIN 不同）。
          </div>

          <div className="grid gap-3 md:grid-cols-[240px_1fr] md:items-end">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">管理员 PIN（4-8 位数字，默认 0000）</div>
              <Input value={adminPin} onChange={(e) => setAdminPin(e.target.value)} placeholder="例如：1234" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-primary text-primary-foreground" onClick={saveAdminPinNow}>保存管理员 PIN</Button>
            </div>
          </div>

          <Separator />

          <div className="text-sm font-medium">忘记 PIN（OTP 自助重置）</div>
          <div className="grid gap-3 md:grid-cols-[240px_1fr] md:items-end">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">OTP（测试版固定 000000）</div>
              <Input value={adminOtp} onChange={(e) => setAdminOtp(e.target.value)} placeholder="000000" />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">新管理员 PIN</div>
              <Input value={newAdminPin} onChange={(e) => setNewAdminPin(e.target.value)} placeholder="例如：5678" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={resetAdminPinByOtp}>重置管理员 PIN</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="ledger-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">接待台锁定（给另一台平板）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            开启后，这台平板会被限制只能停留在【接待台模式】，避免来宾误触进入其它后台页面。
          </div>

          <div className="grid gap-3 md:grid-cols-[240px_1fr] md:items-end">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">解锁 PIN（默认 0000）</div>
              <Input value={kioskPin} onChange={(e) => setKioskPin(e.target.value)} placeholder="例如：1234" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="bg-primary text-primary-foreground" onClick={saveKioskPin}>保存 PIN</Button>
              <Button variant="outline" onClick={resetKioskPin}>重置PIN为0000</Button>
              <Button variant="outline" onClick={forceUnlockKiosk}>强制解除锁定</Button>
              <Button
                variant="outline"
                onClick={() => {
                  localStorage.setItem(LOCK_KEY, "1");
                  window.location.hash = "#/kiosk-lock";
                  toast.success("已进入锁定模式");
                }}
              >
                在本机进入锁定模式
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void (async () => {
                    const ok = await safeCopyText(kioskLockLink());
                    if (ok) toast.success("已复制锁定模式链接");
                    else toast.error("复制失败：请手动复制下方链接");
                  })();
                }}
              >
                复制锁定模式链接
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground break-all">
            {kioskLockLink()}
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed">
            现场建议再搭配平板系统自带的“引导式访问/屏幕固定”，效果更好（可防止切换到浏览器地址栏/其它App）。
          </div>
        </CardContent>
      </Card>

      <Card className="ledger-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">导出（给主办方留档）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            可导出 CSV：来宾名单 + 桌次设置 + 轮盘游戏记录。
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportGuestsCsv}>导出 guests.csv</Button>
            <Button variant="outline" onClick={exportTablesCsv}>导出 tables.csv</Button>
            <Button variant="outline" onClick={exportLotteryCsv}>导出 lottery.csv</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportBackup}>
              导出备份 JSON（可还原）
            </Button>

            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importBackup(f);
                e.currentTarget.value = "";
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              导入备份 JSON
            </Button>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">危险区</div>
            <div className="text-xs text-muted-foreground">
              清空会删除所有来宾、桌次、签到记录。建议先导出备份。
            </div>
            <Button variant="destructive" onClick={resetAll}>
              清空并重置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
