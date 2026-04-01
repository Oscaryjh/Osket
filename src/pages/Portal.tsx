import { useLocation } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PortalPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full paper-noise">
      <div className="mx-auto max-w-3xl p-6 md:p-10">
        <Card className="ledger-border">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-3xl">Osket system</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              请选择进入方式：平台后台（管理场地与计费）或场地后台（创建活动与现场签到）。
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="h-auto justify-start bg-primary px-4 py-4 text-left text-primary-foreground"
                onClick={() => setLocation("/platform-login")}
              >
                <div>
                  <div className="font-medium">进入平台后台</div>
                  <div className="mt-1 text-xs opacity-90">平台 OTP 登录，管理场地/费率/账单</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto justify-start px-4 py-4 text-left"
                onClick={() => setLocation("/login")}
              >
                <div>
                  <div className="font-medium">进入场地后台</div>
                  <div className="mt-1 text-xs text-muted-foreground">手机号 + OTP 登录，创建活动与现场签到</div>
                </div>
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              提示：你也可以直接用链接进入：<br />
              平台后台：#/platform-login；场地后台：#/login
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
