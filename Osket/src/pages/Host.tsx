import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Redirect } from "wouter";

import { loadHostSession, saveHostSession } from "@/lib/host-auth";
import { isHostMember } from "@/lib/host-members";

import Dashboard from "@/pages/Dashboard";
import GuestsPage from "@/pages/Guests";
import SeatingPage from "@/pages/Seating";
import CheckInPage from "@/pages/CheckIn";
import PrintPage from "@/pages/Print";
import QrPage from "@/pages/Qr";
import LotteryPage from "@/pages/Lottery";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { HostProjectProvider, useHostProjectCtx } from "@/contexts/HostProjectContext";

function HostInner() {
  const { project, setProject } = useHostProjectCtx();
  const session = loadHostSession();

  const banquetId = session?.banquetId || "";

  useEffect(() => {
    if (!banquetId) return;
    const exists = project.banquets.some((b) => b.id === banquetId);
    if (!exists) {
      toast.error("活动不存在或无权限");
      return;
    }
    setProject((prev) => ({ ...prev, activeBanquetId: banquetId }));
  }, [banquetId, project.banquets, setProject]);

  const activeName = useMemo(() => project.banquets.find((b) => b.id === project.activeBanquetId)?.event.name || "", [project]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-3xl tracking-tight">主办方后台</div>
          <div className="text-sm text-muted-foreground">当前活动：{activeName}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-accent text-accent-foreground">已授权</Badge>
          <Badge variant="outline">{session?.phone}</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              saveHostSession(null);
              window.location.hash = "#/portal";
              window.location.reload();
            }}
          >
            登出
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="dashboard">总览</TabsTrigger>
          <TabsTrigger value="guests">来宾名单</TabsTrigger>
          <TabsTrigger value="seating">座位编排</TabsTrigger>
          <TabsTrigger value="checkin">签到入场</TabsTrigger>
          <TabsTrigger value="lottery">抽奖游戏</TabsTrigger>
          <TabsTrigger value="print">打印输出</TabsTrigger>
          <TabsTrigger value="qr">来宾查询二维码</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <Dashboard />
        </TabsContent>
        <TabsContent value="guests" className="mt-6">
          <GuestsPage />
        </TabsContent>
        <TabsContent value="seating" className="mt-6">
          <SeatingPage />
        </TabsContent>
        <TabsContent value="checkin" className="mt-6">
          <CheckInPage />
        </TabsContent>
        <TabsContent value="lottery" className="mt-6">
          <LotteryPage />
        </TabsContent>
        <TabsContent value="print" className="mt-6">
          <PrintPage />
        </TabsContent>
        <TabsContent value="qr" className="mt-6">
          <QrPage />
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground leading-relaxed">
        提示：主办方后台为“登入后授权”模式；上线版会改为云端数据库与更完整的权限审计。
      </div>
    </div>
  );
}

export default function HostPage() {
  const session = loadHostSession();
  if (!session) return <Redirect to="/portal" />;

  // 额外校验：必须仍在成员列表中
  if (!isHostMember({ venueId: session.venueId, banquetId: session.banquetId, phone: session.phone })) {
    saveHostSession(null);
    return <Redirect to="/portal" />;
  }

  return (
    <div className="min-h-screen w-full paper-noise">
      <div className="mx-auto max-w-6xl p-6 md:p-10">
        <div className="rounded-2xl bg-card text-card-foreground ledger-border">
          <div className="p-6 md:p-10">
            <HostProjectProvider venueId={session.venueId}>
              <HostInner />
            </HostProjectProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
