// Design reminder (宴会账本): “盖章式”大二维码，现场一眼扫到。
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { safeCopyText } from "@/lib/clipboard";

import { qrDataUrl } from "@/lib/qr";
import { downloadText } from "@/lib/download";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function downloadPng(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function QrPage() {
  const [url, setUrl] = useState("");
  const [dataUrl, setDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const normalized = useMemo(() => url.trim(), [url]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!normalized) {
        setDataUrl("");
        return;
      }

      try {
        setLoading(true);
        const png = await qrDataUrl(normalized, 720);
        if (cancelled) return;
        setDataUrl(png);
      } catch (e: any) {
        if (cancelled) return;
        toast.error(`二维码生成失败：${e?.message || "未知错误"}`);
        setDataUrl("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [normalized]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">来宾查询二维码</h1>
        <p className="text-muted-foreground">
          把“来宾自助查询页”的网址贴进来，就会自动生成二维码。你可以把二维码印出来/发给工作人员，来宾一扫就能进查询页。
        </p>
      </header>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">输入查询页网址</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="例如：https://你的账号.github.io/你的仓库/来宾自助查询页.html"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">建议：上传查询页 HTML 到 GitHub Pages</Badge>
            <Badge className="bg-accent text-accent-foreground">来宾扫码 → 输入姓名/电话后4位</Badge>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">正在生成二维码…</div>
          ) : !dataUrl ? (
            <div className="text-sm text-muted-foreground">贴上网址后会自动生成。</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[320px_1fr] md:items-start">
              <div className="rounded-2xl border border-border bg-white p-4 ledger-border">
                <img src={dataUrl} alt="QR" className="w-full h-auto" />
              </div>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground break-all">{normalized}</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="bg-primary text-primary-foreground"
                    onClick={() => {
                      downloadPng("来宾查询二维码.png", dataUrl);
                      toast.success("已下载二维码 PNG");
                    }}
                  >
                    下载二维码 PNG
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      void (async () => {
                        const ok = await safeCopyText(normalized);
                        if (ok) toast.success("已复制链接");
                        else toast.error("复制失败：此环境不允许写入剪贴板，请手动复制");
                      })();
                    }}
                  >
                    复制链接
                  </Button>
                  <Button variant="outline" onClick={() => window.open(normalized, "_blank")}>打开链接</Button>
                </div>

                <div className="text-xs text-muted-foreground leading-relaxed">
                  小提醒：如果你更在意隐私，我们可以把查询方式改成“查询码”（每位来宾一个随机码），避免用姓名搜。
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="ledger-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-2xl">最短流程</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          1) 在【来宾名单】点“导出查询页（HTML）” → 2) 把那个 HTML 上传到 GitHub Pages
          → 3) 把 Pages 网址贴到本页生成二维码 → 4) 印出来贴在签到处，来宾扫码查询。
        </CardContent>
      </Card>
    </div>
  );
}
