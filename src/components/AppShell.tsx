// Design reminder (宴会账本): 侧边栏像"账本目录"，主区像"纸页"。
import { useEffect, useState, type PropsWithChildren } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { isCloudEnabled } from "@/lib/cloud";
import {
  Users,
  LayoutDashboard,
  Armchair,
  QrCode,
  Printer,
  Settings,
  Gift,
  Wallet,
  UserCheck,
  ScrollText,
} from "lucide-react";

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import BanquetSwitcher from "@/components/BanquetSwitcher";
import TutorialOverlay, { shouldAutoStartTutorial, markTutorialSeen } from "@/components/TutorialOverlay";

const nav = [
  { href: "/", label: "总览", icon: LayoutDashboard },
  { href: "/wallet", label: "场地钱包", icon: Wallet },
  { href: "/host-auth", label: "授权主办方", icon: UserCheck },
  { href: "/audit", label: "操作记录", icon: ScrollText },
  { href: "/guests", label: "来宾名单", icon: Users },
  { href: "/seating", label: "座位编排", icon: Armchair },
  { href: "/checkin", label: "签到入场", icon: QrCode },
  { href: "/kiosk", label: "接待台模式", icon: QrCode },
  { href: "/print", label: "打印输出", icon: Printer },
  { href: "/lottery", label: "轮盘游戏", icon: Gift },
  { href: "/qr", label: "来宾二维码", icon: QrCode },
  { href: "/settings", label: "设置", icon: Settings },
];

export default function AppShell({ children }: PropsWithChildren) {
  const [location] = useLocation();
  const { profile, signOut } = useAuth();
  const cloud = isCloudEnabled(profile?.venue_id);
  const [, setLocation] = useLocation();
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    if (shouldAutoStartTutorial()) {
      setTutorialOpen(true);
    }
  }, []);

  return (
    <div className="min-h-screen w-full paper-noise">
      <SidebarProvider defaultOpen={true}>
        <div className="mx-auto flex min-h-screen w-full">
          <Sidebar
            collapsible="offcanvas"
            className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
          >
            <SidebarHeader className="px-5 py-5">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="font-display text-xl tracking-tight">Osket system</div>
                </div>
                <div className="text-[11px] rounded-md bg-accent/50 px-2 py-1 text-accent-foreground ledger-border">
                  {cloud ? "云端" : "离线"}
                </div>
              </div>
            </SidebarHeader>
            <Separator />
            <SidebarContent className="px-2 py-4">
              <SidebarGroup>
                <SidebarGroupLabel className="px-3 text-[11px] tracking-widest text-muted-foreground">
                  目录
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {nav.map((item) => {
                      const active = location === item.href;
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            className={
                              active
                                ? "bg-sidebar-accent text-sidebar-accent-foreground ledger-border"
                                : "hover:bg-sidebar-accent/60"
                            }
                          >
                            <Link href={item.href}>
                              <Icon className="size-4" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="px-5 py-4 space-y-3">
              <button
                type="button"
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-left text-sm hover:bg-muted/40"
                onClick={() => {
                  markTutorialSeen();
                  setTutorialOpen(true);
                }}
              >
                <div className="font-medium">新手教程</div>
                <div className="mt-1 text-xs text-muted-foreground">一步一步教你新增来宾、桌次与签到</div>
              </button>

              <button
                type="button"
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-left text-sm hover:bg-muted/40"
                onClick={() => {
                  if (!confirm("确定要登出吗？")) return;
                  void (async () => {
                    try {
                      await signOut();
                      toast.success("已登出");
                      setLocation("/portal");
                    } catch (e: any) {
                      toast.error(e?.message || "登出失败");
                    }
                  })();
                }}
              >
                <div className="font-medium">登出</div>
                <div className="mt-1 text-xs text-muted-foreground">退出当前账号，返回入口页</div>
              </button>

              <div className="text-xs text-muted-foreground leading-relaxed">
                提示：记得在【设置】里导出备份 JSON，避免浏览器清缓存丢资料。
              </div>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>

          <SidebarInset className="p-4 md:p-8 lg:p-10">
            <TutorialOverlay open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
            <div className="mb-4 flex flex-col gap-3 md:mb-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <SidebarTrigger className="mt-0.5" />
                <div>
                  <div className="font-display text-2xl tracking-tight">后台管理</div>
                  <div className="text-xs text-muted-foreground">多宴会：每场独立名单/座位/签到</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <BanquetSwitcher />
              </div>
            </div>
            <div className="mx-auto max-w-6xl">
              <div className="rounded-2xl bg-card text-card-foreground ledger-border">
                <div className="p-6 md:p-10">{children}</div>
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
