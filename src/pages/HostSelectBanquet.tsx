import { useMemo } from "react";
import { Redirect, useLocation } from "wouter";
import { toast } from "sonner";

import { loadHostSession, saveHostSession } from "@/lib/host-auth";
import { loadProject } from "@/lib/storage";
import { addHostMember } from "@/lib/host-members";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function HostSelectBanquetPage() {
  const session = loadHostSession();
  const [, setLocation] = useLocation();

  const project = useMemo(() => (session ? loadProject(session.venueId) : null), [session?.venueId]);

  if (!session) return <Redirect to="/portal" />;
  if (!project) return <div className="p-6">读取场地数据失败</div>;

  return (
    <div className="min-h-screen w-full paper-noise">
      <div className="mx-auto max-w-4xl p-6 md:p-10">
        <Card className="ledger-border">
          <CardHeader>
            <CardTitle className="font-display text-2xl">选择宴会</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-accent text-accent-foreground">已授权</Badge>
              <Badge variant="outline">{session.phone}</Badge>
            </div>

            <div className="text-sm text-muted-foreground">
              请选择要进入的宴会。进入后你将获得该宴会的主办方权限（名单、分桌、签到等）。
            </div>

            <div className="grid gap-3">
              {project.banquets.map((b) => (
                <button
                  key={b.id}
                  className="rounded-xl border border-border bg-background p-4 text-left hover:bg-muted/30"
                  onClick={() => {
                    // 写入该宴会成员
                    addHostMember({
                      venueId: session.venueId,
                      banquetId: b.id,
                      phone: session.phone,
                      role: session.role,
                      addedBy: "venue_owner",
                    });

                    // 更新 host session 进入该宴会
                    saveHostSession({ ...session, banquetId: b.id });
                    toast.success("已进入主办方后台");
                    setLocation("/host");
                  }}
                >
                  <div className="font-medium">{b.event?.name || "(未命名活动)"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    日期：{b.event?.date || "-"} · 状态：{b.event?.locked ? "已锁定" : "未锁定"}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  saveHostSession(null);
                  window.location.hash = "#/portal";
                  window.location.reload();
                }}
              >
                取消并登出
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
