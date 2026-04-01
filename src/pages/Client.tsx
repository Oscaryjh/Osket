import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Redirect } from "wouter";

import { useProject } from "@/hooks/use-project";
import { tokenToEventId } from "@/lib/demo-tokens";

import Dashboard from "@/pages/Dashboard";
import GuestsPage from "@/pages/Guests";
import SeatingPage from "@/pages/Seating";
import CheckInPage from "@/pages/CheckIn";
import PrintPage from "@/pages/Print";
import QrPage from "@/pages/Qr";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

function getTokenFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return params.get("t") || "";
}

export default function ClientPage() {
  const { project, setProject } = useProject();
  const token = getTokenFromLocation();

  const banquetId = useMemo(() => tokenToEventId(token), [token]);

  useEffect(() => {
    if (!token) return;
    if (!banquetId) {
      toast.error("链接无效或已失效（token 不存在）");
      return;
    }

    // force active banquet to the one bound with token
    setProject((prev) => ({ ...prev, activeBanquetId: banquetId }));
  }, [token, banquetId, setProject]);

  const activeName = project.banquets.find((b) => b.id === project.activeBanquetId)?.event.name || "";

  if (!token) return <Redirect to="/platform" />;
  if (!banquetId) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl">客户后台（Demo）</h1>
        <div className="text-muted-foreground">此链接无效或已失效。请联系平台重新取得链接。</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-3xl tracking-tight">客户后台（Demo）</div>
          <div className="text-sm text-muted-foreground">当前客户案：{activeName}</div>
        </div>
        <Badge className="bg-accent text-accent-foreground">免登入链接（token）</Badge>
      </div>

      <Tabs defaultValue="guests">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="guests">来宾名单</TabsTrigger>
          <TabsTrigger value="seating">座位编排</TabsTrigger>
          <TabsTrigger value="checkin">签到入场</TabsTrigger>
          <TabsTrigger value="print">打印输出</TabsTrigger>
          <TabsTrigger value="qr">来宾查询二维码</TabsTrigger>
        </TabsList>

        <TabsContent value="guests" className="mt-6">
          <GuestsPage />
        </TabsContent>
        <TabsContent value="seating" className="mt-6">
          <SeatingPage />
        </TabsContent>
        <TabsContent value="checkin" className="mt-6">
          <CheckInPage />
        </TabsContent>
        <TabsContent value="print" className="mt-6">
          <PrintPage />
        </TabsContent>
        <TabsContent value="qr" className="mt-6">
          <QrPage />
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground leading-relaxed">
        Demo 说明：本版本为了先确认流程，数据仍保存在浏览器本地；上线版会改成云端数据库并使用 Edge Function 验证 token。
      </div>
    </div>
  );
}
