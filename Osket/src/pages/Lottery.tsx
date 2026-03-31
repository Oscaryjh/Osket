// Design reminder (宴会账本): 抽奖页要像"节目单"一样高能量，但操作要极简。
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useProject } from "@/hooks/use-project";
import type { Guest } from "@/lib/model";
import { loadLotteryWinners, saveLotteryWinners, type LotteryWinner } from "@/lib/lottery";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

type Scope = "all" | "checked_in" | "not_checked_in";

function pickTextColor(hex: string) {
  // simple luminance on rgb
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#111827" : "#ffffff";
}

// 性能优化：把“名字+扇区”预先画到离屏 canvas，动画时只做旋转贴图。
function buildWheelCanvas(names: string[], size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;

  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.translate(cx, cy);

  const n = Math.max(1, names.length);
  const step = (Math.PI * 2) / n;

  const palette = [
    "#0ea5e9", // sky
    "#f97316", // orange
    "#a855f7", // purple
    "#22c55e", // green
    "#e11d48", // rose
    "#eab308", // amber
    "#14b8a6", // teal
  ];

  for (let i = 0; i < n; i++) {
    const a0 = i * step;
    const a1 = a0 + step;
    const color = palette[i % palette.length];

    // slice
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // separator line at a0
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.stroke();

    // label
    const mid = (a0 + a1) / 2;
    ctx.save();
    ctx.rotate(mid);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const raw = names[i] || "";
    const label = raw.length > 6 ? raw.slice(0, 6) + "…" : raw;

    const fontSize = Math.max(12, Math.min(18, Math.floor(240 / Math.max(10, n)) * 2));
    ctx.font = `800 ${fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`;

    const fill = pickTextColor(color);
    ctx.fillStyle = fill;
    // 描边增强可读性（避免白字落在浅色扇区看不见）
    ctx.lineWidth = 5;
    ctx.strokeStyle = fill === "#ffffff" ? "rgba(15,23,42,0.45)" : "rgba(255,255,255,0.7)";
    ctx.strokeText(label, r - 14, 0);
    ctx.fillText(label, r - 14, 0);

    ctx.restore();
  }

  // separator at end (2π)
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();

  // rim
  ctx.strokeStyle = "rgba(15,23,42,0.25)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
  return c;
}

function drawPointerAndCap(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.46;

  // pointer（指向轮盘内侧）
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  // tip closer to wheel
  ctx.moveTo(0, -r + 12);
  // base outside the wheel
  ctx.lineTo(-16, -r - 14);
  ctx.lineTo(16, -r - 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // center cap
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(15,23,42,0.25)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

export default function LotteryPage() {
  const { activeBanquet: banquet } = useProject();

  const [scope, setScope] = useState<Scope>("all");
  const [excludeWinners, setExcludeWinners] = useState(true);

  const [winners, setWinners] = useState<LotteryWinner[]>(() => loadLotteryWinners(banquet.id));
  useEffect(() => setWinners(loadLotteryWinners(banquet.id)), [banquet.id]);

  const winnerIds = useMemo(() => new Set(winners.map((w) => w.guestId)), [winners]);

  const eligible = useMemo(() => {
    return banquet.guests.filter((g) => {
      if (excludeWinners && winnerIds.has(g.id)) return false;
      if (scope === "checked_in") return g.checkIn?.status === "checked_in";
      if (scope === "not_checked_in") return g.checkIn?.status !== "checked_in";
      return true;
    });
  }, [banquet.guests, winnerIds, excludeWinners, scope]);

  const names = useMemo(() => eligible.map((g) => g.name || "(未命名)"), [eligible]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const rotationRef = useRef(0); // radians

  const [isSpinning, setIsSpinning] = useState(false);
  const [lastWinner, setLastWinner] = useState<Guest | null>(null);

  function render(rot: number) {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const size = c.width;
    const cx = size / 2;
    const cy = size / 2;

    ctx.clearRect(0, 0, size, size);

    const wheel = wheelRef.current;
    if (wheel) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.drawImage(wheel, -cx, -cy);
      ctx.restore();
    } else {
      // fallback: 建立一次
      wheelRef.current = buildWheelCanvas(names.length ? names : ["暂无可抽人选"], size);
      ctx.drawImage(wheelRef.current, 0, 0);
    }

    drawPointerAndCap(ctx, size);
  }

  // 当名单变化时重建离屏轮盘（重文本绘制只做一次），动画会更稳。
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    wheelRef.current = buildWheelCanvas(names.length ? names : ["暂无可抽人选"], c.width);
    render(rotationRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  function persist(next: LotteryWinner[]) {
    setWinners(next);
    saveLotteryWinners(banquet.id, next);
  }

  function spin() {
    if (isSpinning) return;
    if (eligible.length === 0) {
      toast.error("没有可抽的人选（请检查筛选条件）");
      return;
    }

    const n = eligible.length;
    const winnerIndex = Math.floor(Math.random() * n);

    // pointer is at top (-90deg). We want the chosen segment center to land at top.
    const step = (Math.PI * 2) / n;
    const targetAngle = -(winnerIndex * step + step / 2); // segment center to 0 rad

    // 让每次都更“紧张”：固定高圈数（避免有时慢）
    const extraTurns = 14; // fixed turns
    const start = rotationRef.current;
    const end = targetAngle + extraTurns * Math.PI * 2;

    const duration = 2800;
    const t0 = performance.now();

    setIsSpinning(true);
    setLastWinner(null);

    const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

    const TAU = Math.PI * 2;
    const norm = (rad: number) => ((rad % TAU) + TAU) % TAU;

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = easeOutQuint(p);
      const nextRot = start + (end - start) * eased;
      const nrot = norm(nextRot);
      rotationRef.current = nrot;
      render(nrot);

      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      setIsSpinning(false);
      const w = eligible[winnerIndex];
      setLastWinner(w);
      const rec: LotteryWinner = { guestId: w.id, name: w.name, timeUtc: new Date().toISOString() };
      persist([rec, ...winners]);
      toast.success(`恭喜：${w.name}`);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  function clearWinners() {
    if (!confirm("确定清空本场宴会的抽奖记录吗？")) return;
    persist([]);
    toast.success("已清空抽奖记录");
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">轮盘游戏</h1>
        <p className="text-muted-foreground">
          从本场宴会的来宾名单中抽出幸运儿。默认会自动排除已中奖的人。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="ledger-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-2xl">轮盘</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-square w-full overflow-hidden rounded-2xl border border-border bg-background">
              <canvas ref={canvasRef} width={420} height={420} className="h-full w-full" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button className="bg-primary text-primary-foreground" disabled={isSpinning} onClick={spin}>
                {isSpinning ? "抽奖中…" : "开始抽奖"}
              </Button>
              <Badge variant="secondary">可抽 {eligible.length} 人</Badge>
              {lastWinner ? (
                <Badge className="bg-accent text-accent-foreground">最新：{lastWinner.name}</Badge>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              小提示：如果人数很多，轮盘上的名字会自动缩短显示，但抽取结果仍以完整名单为准。
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="ledger-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-2xl">抽取范围</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant={scope === "all" ? "default" : "outline"} onClick={() => setScope("all")}>
                  全部来宾
                </Button>
                <Button
                  variant={scope === "checked_in" ? "default" : "outline"}
                  onClick={() => setScope("checked_in")}
                >
                  仅已签到
                </Button>
                <Button
                  variant={scope === "not_checked_in" ? "default" : "outline"}
                  onClick={() => setScope("not_checked_in")}
                >
                  仅未签到
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <div className="text-sm font-medium">排除已中奖者</div>
                  <div className="text-xs text-muted-foreground">
                    开启后：中奖者会从轮盘名单移除（第二次抽奖就不会再显示）
                  </div>
                </div>
                <Switch checked={excludeWinners} onCheckedChange={setExcludeWinners} />
              </div>

              {excludeWinners && winnerIds.size > 0 ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  当前已排除 <span className="font-medium text-foreground">{winnerIds.size}</span> 位已中奖来宾。
                  若你希望轮盘每次都显示全部人名，请先关闭“排除已中奖者”。
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="ledger-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-2xl">中奖记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={clearWinners}>
                  清空记录
                </Button>
              </div>

              {winners.length === 0 ? (
                <div className="text-sm text-muted-foreground">还没有抽出幸运儿。</div>
              ) : (
                <div className="grid gap-2">
                  {winners.slice(0, 30).map((w) => (
                    <div key={w.timeUtc + w.guestId} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
                      <div>
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(w.timeUtc).toLocaleString()}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          const next = winners.filter((x) => !(x.guestId === w.guestId && x.timeUtc === w.timeUtc));
                          persist(next);
                          toast.success("已移除该条记录");
                        }}
                      >
                        移除
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-muted-foreground leading-relaxed">
                说明：抽奖记录只保存在浏览器本地；建议活动前先在【设置】导出备份 JSON。
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
