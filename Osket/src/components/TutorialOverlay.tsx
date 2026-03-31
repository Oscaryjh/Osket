import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SEEN_KEY = "osket.tutorial.seen";

type Step = {
  id: string;
  title: string;
  body: string;
  href?: string; // navigate to
  target?: string; // [data-tour="..."]
};

function findTarget(selector?: string) {
  if (!selector) return null;
  try {
    return document.querySelector(selector) as HTMLElement | null;
  } catch {
    return null;
  }
}

function getRect(el: HTMLElement | null) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    right: r.right,
    bottom: r.bottom,
  };
}

export function shouldAutoStartTutorial() {
  return localStorage.getItem(SEEN_KEY) !== "1";
}

export function markTutorialSeen() {
  localStorage.setItem(SEEN_KEY, "1");
}

export default function TutorialOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();

  const steps: Step[] = useMemo(
    () => [
      {
        id: "welcome",
        title: "欢迎使用 Osket system",
        body: "我会用 1 分钟带你走一遍：新增来宾 → 新增桌次 → 拖拽分桌 → 现场签到。",
        href: "/",
      },
      {
        id: "go-guests",
        title: "第一步：来宾名单",
        body: "先到【来宾名单】导入 CSV 或手动新增来宾。",
        href: "/guests",
      },
      {
        id: "add-guest",
        title: "新增来宾",
        body: "点这里新增单个来宾（姓名必填）。如果你有 Excel/CSV 名单，建议用“导入 CSV”更快。",
        href: "/guests",
        target: '[data-tour="guest-add"]',
      },
      {
        id: "import-csv",
        title: "导入 CSV（更快）",
        body: "如果名单很多，用“导入 CSV”一次导入最省时间；也可先下载模板。",
        href: "/guests",
        target: '[data-tour="guest-import"]',
      },
      {
        id: "go-seating",
        title: "第二步：座位编排",
        body: "接下来新增桌次，并把来宾拖到桌里自动排座号。",
        href: "/seating",
      },
      {
        id: "add-table",
        title: "新增桌次",
        body: "点“新增桌次”建立 A01/A02… 然后把左边未分桌来宾拖到桌里。",
        href: "/seating",
        target: '[data-tour="table-add"]',
      },
      {
        id: "drag-tip",
        title: "拖拽分桌",
        body: "把未分桌来宾拖到桌卡片里即可；要退回未分桌，就把桌里来宾拖回左边。",
        href: "/seating",
        target: '[data-tour="pool"]',
      },
      {
        id: "go-kiosk",
        title: "第三步：现场签到（接待台）",
        body: "活动当天用平板开【接待台模式】：输入姓名/电话后4位 → 一键签到。",
        href: "/kiosk",
      },
      {
        id: "finish",
        title: "完成",
        body: "建议：活动前先到【设置】导出备份 JSON；活动结束可“锁定”避免误改。需要时可随时从侧边栏再打开教程。",
        href: "/settings",
      },
    ],
    []
  );

  const [idx, setIdx] = useState(0);

  // reset when open
  useEffect(() => {
    if (open) setIdx(0);
  }, [open]);

  // navigate on step change
  useEffect(() => {
    if (!open) return;
    const s = steps[idx];
    if (s?.href) setLocation(s.href);
    // 等页面渲染后再滚动定位
    const t = window.setTimeout(() => {
      const el = findTarget(s?.target);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 250);
    return () => window.clearTimeout(t);
  }, [open, idx, steps, setLocation]);

  // compute highlight
  const step = steps[idx];
  const targetEl = open ? findTarget(step?.target) : null;
  const rect = open ? getRect(targetEl) : null;

  if (!open) return null;

  const pad = 10;
  const holeStyle = rect
    ? {
        left: Math.max(0, rect.left - pad),
        top: Math.max(0, rect.top - pad),
        width: Math.max(0, rect.width + pad * 2),
        height: Math.max(0, rect.height + pad * 2),
      }
    : null;

  function next() {
    if (idx >= steps.length - 1) {
      markTutorialSeen();
      onClose();
      return;
    }
    setIdx((v) => Math.min(steps.length - 1, v + 1));
  }

  function prev() {
    setIdx((v) => Math.max(0, v - 1));
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />

      {/* highlight hole */}
      {holeStyle ? (
        <div
          className="absolute rounded-2xl ring-2 ring-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
          style={{ ...(holeStyle as any), pointerEvents: "none" }}
        />
      ) : null}

      {/* panel */}
      <div className="absolute left-1/2 top-6 w-[min(680px,calc(100%-24px))] -translate-x-1/2">
        <div className="rounded-2xl bg-card text-card-foreground ledger-border">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="font-display text-xl">新手教程</div>
              <Badge variant="secondary">
                {idx + 1}/{steps.length}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              关闭
            </Button>
          </div>

          <div className="space-y-2 px-4 py-4">
            <div className="font-display text-2xl">{step.title}</div>
            <div className="text-sm text-muted-foreground leading-relaxed">{step.body}</div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
            <Button variant="outline" onClick={prev} disabled={idx === 0}>
              上一步
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  markTutorialSeen();
                  onClose();
                }}
              >
                以后不再自动弹出
              </Button>
              <Button className="bg-primary text-primary-foreground" onClick={next}>
                {idx >= steps.length - 1 ? "完成" : "下一步"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
