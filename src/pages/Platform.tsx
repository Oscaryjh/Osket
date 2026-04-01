import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useProject } from "@/hooks/use-project";
import { createBanquet } from "@/lib/storage";
import { createToken, deleteToken, loadTokens, rotateToken } from "@/lib/demo-tokens";
import { safeCopyText } from "@/lib/clipboard";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function baseUrl() {
  // In GitHub Pages demo, hash routing is used
  return window.location.origin + window.location.pathname;
}

export default function PlatformPage() {
  const { project, setProject } = useProject();
  const [name, setName] = useState("");
  const [tokens, setTokens] = useState(() => loadTokens());

  useEffect(() => {
    const t = window.setInterval(() => setTokens(loadTokens()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const clientLink = useMemo(() => {
    const b = baseUrl();
    return (token: string) => `${b}#/client?t=${encodeURIComponent(token)}`;
  }, []);

  function createEvent() {
    const eventName = name.trim();
    if (!eventName) {
      toast.error("请先输入客户案名称");
      return;
    }

    // Demo simplification: 1 event = 1 banquet
    const banquet = createBanquet(eventName, 10);
    setProject((prev) => ({
      ...prev,
      activeBanquetId: banquet.id,
      banquets: [...prev.banquets, banquet],
    }));

    const rec = createToken(banquet.id, eventName);
    void (async () => {
      const ok = await safeCopyText(clientLink(rec.token));
      if (ok) toast.success("已建立客户案，并复制客户链接");
      else toast.success("已建立客户案（此环境不允许自动复制，请手动复制下方链接）");
    })();
    setName("");
    setTokens(loadTokens());
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">平台管理（Demo）</h1>
        <p className="text-muted-foreground">
          这里模拟你作为平台方：建立客户案（一个客户=一个 event=一个宴会），系统会生成客户专属后台链接（免登入）。
        </p>
      </header>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">新增客户案</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：isaac wedding" />
          </div>
          <Button className="bg-primary text-primary-foreground" onClick={createEvent}>
            建立并生成链接
          </Button>
        </CardContent>
      </Card>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">已建立的客户链接</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tokens.length === 0 ? (
            <div className="text-sm text-muted-foreground">目前还没有客户链接。</div>
          ) : (
            tokens.map((t) => (
              <div key={t.token} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{t.eventName}</div>
                      <Badge variant="secondary">免登入链接</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground break-all">{clientLink(t.token)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void (async () => {
                          const ok = await safeCopyText(clientLink(t.token));
                          if (ok) toast.success("已复制链接");
                          else toast.error("复制失败：此环境不允许写入剪贴板，请手动复制");
                        })();
                      }}
                    >
                      复制
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const next = rotateToken(t.token);
                        if (!next) return toast.error("找不到该 token");
                        void (async () => {
                          const ok = await safeCopyText(clientLink(next.token));
                          if (ok) toast.success("已重置 token（旧链接失效），并复制新链接");
                          else toast.success("已重置 token（旧链接失效）。此环境不允许自动复制，请手动复制新链接");
                          setTokens(loadTokens());
                        })();
                      }}
                    >
                      重置token
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (!confirm("确定删除这个客户链接吗？客户将无法再打开后台。")) return;
                        deleteToken(t.token);
                        toast.success("已删除链接");
                        setTokens(loadTokens());
                      }}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="text-xs text-muted-foreground leading-relaxed">
            注意：这是 AnyGen 内的 Demo（token 与数据存在浏览器本地）。上线时会改成云端数据库 + Edge Function 验证 token。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
