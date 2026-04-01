import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useProject } from "@/hooks/use-project";
import { requireVenueId } from "@/lib/venue-auth";
import { safeCopyText } from "@/lib/clipboard";
import {
  createHostInvite,
  deleteHostInvite,
  isHostInviteExpired,
  loadHostInvites,
  revokeHostInvite,
} from "@/lib/host-invites";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { NativeSelect } from "@/components/ui/native-select";

export default function HostAuthorizationPage() {
  const { project, setProject } = useProject();

  const venueId = requireVenueId();

  const [banquetId, setBanquetId] = useState(() => project.activeBanquetId);
  const [hostPhone, setHostPhone] = useState("");
  const [inviteExpiryDays, setInviteExpiryDays] = useState<number>(30);
  const [showInactiveInvites, setShowInactiveInvites] = useState(false);
  const [, force] = useState(0);

  const selectedBanquet = useMemo(() => project.banquets.find((b) => b.id === banquetId) || project.banquets[0], [project, banquetId]);

  const memberList = selectedBanquet?.hostMembers || [];

  const invites = useMemo(() => {
    if (!venueId || !banquetId) return [];
    const base = loadHostInvites().filter((x) => x.venueId === venueId && x.banquetId === banquetId);
    const filtered = base.filter((x) => (showInactiveInvites ? true : x.status === "active" && !isHostInviteExpired(x)));
    return filtered.slice(0, 20);
  }, [venueId, banquetId, showInactiveInvites]);

  function onRemoveMember(phone: string) {
    if (!selectedBanquet) return;
    if (!confirm(`确定要移除成员 ${phone} 吗？`)) return;

    // 必须通过 ProjectContext 更新，避免被自动保存覆盖
    setProject((prev) => ({
      ...prev,
      banquets: prev.banquets.map((b) =>
        b.id === selectedBanquet.id
          ? { ...b, hostMembers: (b.hostMembers || []).filter((m) => m.phone !== phone) }
          : b
      ),
    }));

    toast.success("已移除成员");
    force((n) => n + 1);
  }

  function generateInvite() {
    if (!venueId) return toast.error("未登录场地账号");
    if (!banquetId) return toast.error("请先选择宴会");

    const expiresAtUtc =
      inviteExpiryDays <= 0 ? undefined : new Date(Date.now() + inviteExpiryDays * 24 * 60 * 60 * 1000).toISOString();

    const inv = createHostInvite({
      venueId,
      banquetId,
      role: "host_admin",
      invitedPhone: hostPhone.trim() || undefined,
      mode: "multi_use",
      expiresAtUtc,
      createdBy: "venue_owner",
    });

    const url = `${window.location.origin + window.location.pathname}#/host-invite/${inv.token}`;
    void (async () => {
      const ok = await safeCopyText(url);
      if (ok) toast.success("已复制主办方邀请链接");
      else toast.error("复制失败：请手动复制");
    })();

    force((n) => n + 1);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">授权主办方</h1>
        <p className="text-muted-foreground page-subtitle">先选择宴会，再生成邀请链接。主办方只能进入被授权的那一场。</p>
      </header>

      <Card className="ledger-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">生成邀请链接</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="grid gap-4 md:grid-cols-2 md:items-end">
              <div className="space-y-2">
                <div className="text-sm font-medium">指定宴会（必选）</div>
                <NativeSelect
                  value={banquetId}
                  onChange={(e) => {
                    setBanquetId(e.target.value);
                    // 只影响授权页的选择，不强制切换全局 active banquet
                  }}
                >
                  {project.banquets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {(b.event?.date ? `${b.event.date} · ` : "") + (b.event?.name || "(未命名活动)")}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">限定手机号（可选）</div>
                <div className="text-xs text-muted-foreground">留空 = 任何手机号都可用（仍需 OTP 登入）。</div>
                <Input value={hostPhone} onChange={(e) => setHostPhone(e.target.value)} placeholder="例如：0123456789" />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-sm font-medium">邀请有效期</div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={inviteExpiryDays === 1 ? "default" : "outline"} onClick={() => setInviteExpiryDays(1)}>
                  1天
                </Button>
                <Button type="button" size="sm" variant={inviteExpiryDays === 7 ? "default" : "outline"} onClick={() => setInviteExpiryDays(7)}>
                  7天
                </Button>
                <Button type="button" size="sm" variant={inviteExpiryDays === 30 ? "default" : "outline"} onClick={() => setInviteExpiryDays(30)}>
                  30天
                </Button>
                <Button type="button" size="sm" variant={inviteExpiryDays === 0 ? "default" : "outline"} onClick={() => setInviteExpiryDays(0)}>
                  永不过期
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">默认 30 天。</div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="bg-primary text-primary-foreground" onClick={generateInvite}>
                生成并复制邀请链接
              </Button>
              <Button variant="outline" onClick={() => setHostPhone("")}>清空手机号</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="ledger-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">邀请与成员（该宴会）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">最近邀请</div>
              <Button
                type="button"
                size="sm"
                variant={showInactiveInvites ? "default" : "outline"}
                onClick={() => setShowInactiveInvites((v) => !v)}
              >
                {showInactiveInvites ? "显示：全部" : "显示：仅可用"}
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {invites.map((x) => {
                const expired = isHostInviteExpired(x);
                const canUse = x.status === "active" && !expired;
                return (
                  <div key={x.token} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-2 text-sm">
                    <div className="text-muted-foreground break-all">
                      {canUse ? "可用" : x.status === "revoked" ? "已撤销" : expired ? "已过期" : "不可用"}
                      {x.invitedPhone ? ` · phone=${x.invitedPhone}` : " · (不限手机号)"}
                      {x.expiresAtUtc ? ` · expires=${x.expiresAtUtc}` : ""}
                      {(x.uses || []).length ? ` · uses=${(x.uses || []).length}` : ""}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canUse}
                        onClick={() => {
                          const url = `${window.location.origin + window.location.pathname}#/host-invite/${x.token}`;
                          void (async () => {
                            const ok = await safeCopyText(url);
                            if (ok) toast.success("已复制邀请链接");
                            else toast.error("复制失败：请手动复制");
                          })();
                        }}
                      >
                        复制链接
                      </Button>

                      {x.status === "active" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (!confirm("确定要撤销该邀请吗？撤销后默认不显示（可切换显示全部查看）。")) return;
                            revokeHostInvite(x.token);
                            toast.success("已撤销邀请");
                            force((n) => n + 1);
                          }}
                        >
                          撤销
                        </Button>
                      ) : null}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!confirm("确定要删除这条邀请记录吗？删除后无法追溯。")) return;
                          deleteHostInvite(x.token);
                          toast.success("已删除邀请记录");
                          force((n) => n + 1);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                );
              })}

              {invites.length === 0 ? <div className="text-xs text-muted-foreground">暂无邀请记录。</div> : null}
            </div>
          </div>

          <Separator />

          <div className="rounded-xl border border-border bg-background p-3">
            <div className="text-sm font-medium">已授权成员</div>
            <div className="mt-2 space-y-2">
              {memberList.length === 0 ? (
                <div className="text-xs text-muted-foreground">暂无成员。</div>
              ) : (
                memberList.map((m) => (
                  <div key={m.phone} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="text-muted-foreground">{m.phone} · {m.role} · {m.addedAtUtc}</div>
                    <Button size="sm" variant="destructive" onClick={() => onRemoveMember(m.phone)}>
                      移除
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
