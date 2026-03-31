// 平台后台登录：Supabase Auth（测试阶段用 email/password）
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PlatformLoginPage() {
  const [, setLocation] = useLocation();
  const { profile, refreshProfile } = useAuth();

  const [email, setEmail] = useState("platform@example.com");
  const [password, setPassword] = useState("12345678");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.role === "platform") {
      setLocation("/platform-admin");
    }
  }, [profile?.role, setLocation]);

  async function login() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await refreshProfile();
      toast.success("登录成功");
      setLocation("/platform-admin");
    } catch (e: any) {
      toast.error(e?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full paper-noise">
      <div className="mx-auto max-w-lg p-6 md:p-10">
        <Card className="ledger-border">
          <CardHeader>
            <CardTitle className="font-display text-2xl">平台登入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              使用平台测试账号登录（后续可切换手机 OTP / SSO）。
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="platform@example.com" />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Password</div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="12345678" />
            </div>
            <Button className="w-full bg-primary text-primary-foreground" onClick={login} disabled={loading}>
              平台登入
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
