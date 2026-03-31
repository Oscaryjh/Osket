// 场地登录：Supabase Auth（测试阶段用 email/password）
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function parseLoginParams() {
  const h = window.location.hash || "";

  // New format: #/login/<phone>/<seed>
  // Example: #/login/0168240021/xxxx
  const m = h.match(/^#\/login\/([^/?#]+)\/([^/?#]+)$/);
  if (m) {
    return { phone: decodeURIComponent(m[1] || ""), seed: decodeURIComponent(m[2] || "") };
  }

  // New format without seed: #/login/<phone>
  const m2 = h.match(/^#\/login\/([^/?#]+)$/);
  if (m2) {
    return { phone: decodeURIComponent(m2[1] || ""), seed: "" };
  }

  // Legacy format: #/login?phone=...&seed=...
  const i = h.indexOf("?");
  if (i !== -1) {
    const qs = h.slice(i + 1);
    const p = new URLSearchParams(qs);
    return { phone: p.get("phone") || "", seed: p.get("seed") || "" };
  }

  return { phone: "", seed: "" };
}

export default function LoginPage() {
  void parseLoginParams();

  const [, setLocation] = useLocation();
  const { profile, refreshProfile } = useAuth();

  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("12345678");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile?.role === "venue_owner") {
      setLocation("/");
    }
  }, [profile?.role, setLocation]);

  async function login() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await refreshProfile();
      toast.success("登录成功");
      setLocation("/");
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
            <CardTitle className="font-display text-2xl">场地登入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              使用场地测试账号登录（后续可切换手机 OTP）。
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" />
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Password</div>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="12345678" />
            </div>

            <Button className="w-full bg-primary text-primary-foreground" onClick={login} disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
