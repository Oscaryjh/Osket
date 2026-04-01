import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";

import { getHostInvite, redeemHostInvite } from "@/lib/host-invites";
import { saveHostSession } from "@/lib/host-auth";
import { addHostMember } from "@/lib/host-members";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const OTP = "000000";

export default function HostInvitePage() {
  const [, params] = useRoute("/host-invite/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();

  const invite = useMemo(() => (token ? getHostInvite(token) : null), [token]);

  const [phone, setPhone] = useState(invite?.invitedPhone || "");
  const [otp, setOtp] = useState(OTP);

  function accept() {
    if (!invite) return toast.error("邀请链接无效或已失效");
    if (!phone.trim()) return toast.error("请输入手机号");
    if (otp.trim() !== OTP) return toast.error("OTP 不正确（测试版固定 000000）");

    const res = redeemHostInvite(token, phone.trim());
    if (!res.ok) {
      if (res.reason === "phone_mismatch") return toast.error("此邀请仅限指定手机号使用");
      if (res.reason === "expired") return toast.error("邀请链接已过期");
      if (res.reason === "used") return toast.error("邀请已被使用（一次性）");
      return toast.error("邀请已失效");
    }

    // 写入成员列表（本地版：直接写入场地项目数据）


    // 写入成员列表（单宴会授权）
    addHostMember({
      venueId: res.invite.venueId,
      banquetId: res.invite.banquetId,
      phone: phone.trim(),
      role: res.invite.role,
      addedBy: "venue_owner",
    });

    saveHostSession({
      phone: phone.trim(),
      venueId: res.invite.venueId,
      banquetId: res.invite.banquetId,
      role: res.invite.role,
      createdAtUtc: new Date().toISOString(),
    });

    toast.success("已授权，进入主办方后台");
    setLocation("/host");
  }

  return (
    <div className="min-h-screen w-full paper-noise">
      <div className="mx-auto max-w-xl p-6 md:p-10">
        <Card className="ledger-border">
          <CardHeader>
            <CardTitle className="font-display text-2xl">主办方后台授权</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!invite ? (
              <div className="text-sm text-muted-foreground">此邀请链接无效或已失效。</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-accent text-accent-foreground">登入后授权</Badge>
                  <Badge variant="outline">角色：{invite.role === "host_admin" ? "主办方管理员" : "主办方工作人员"}</Badge>
                </div>

                <div className="text-sm text-muted-foreground">请用主办方手机号登入后完成授权。</div>

                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">手机号</div>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="例如：0123456789" />
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">OTP（测试版固定 000000）</div>
                  <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" />
                </div>

                <Button className="w-full bg-primary text-primary-foreground" onClick={accept}>
                  登入并接受授权
                </Button>

                <Button variant="outline" className="w-full" onClick={() => setLocation("/portal")}>
                  返回入口
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
