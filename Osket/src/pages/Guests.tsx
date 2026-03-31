// Design reminder (宴会账本): 表格像"账页"，操作按钮像"盖章"。
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { useProject } from "@/hooks/use-project";
import type { Guest } from "@/lib/model";
import { createGuest } from "@/lib/storage";
import { downloadText } from "@/lib/download";
import { guestsToCsvRows, parseGuestsCsv, stringifyCsv } from "@/lib/csv";
import { buildLookupHtml } from "@/lib/lookup-export";
import { guestsByTable, nextEmptySeat } from "@/lib/seating";

const guestSchema = z.object({
  name: z.string().min(1, "请填写姓名"),
  phone: z.string(),
  group: z.string(),
  party: z.enum(["男方", "女方", "不分"]),
  isVip: z.boolean(),
  // 桌号/座号：tableId 为空表示未分桌
  tableId: z.string(),
  seatNo: z.number().int().min(1).max(30).nullable(),
  notes: z.string(),
});

type GuestForm = z.infer<typeof guestSchema>;

function normalizeBool(s?: string) {
  if (!s) return false;
  const v = String(s).trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "y" || v === "是";
}

export default function GuestsPage() {
  const { activeBanquet: banquet, updateActiveBanquet } = useProject();
  const locked = !!banquet.event.locked;
  const project = banquet; // alias for minimal diff
  const setProject = (b: any) => updateActiveBanquet(() => b);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Guest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [lookupDialogOpen, setLookupDialogOpen] = useState(false);
  const [lookupAllowPhoneLast4, setLookupAllowPhoneLast4] = useState(true);

  const form = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      name: "",
      phone: "",
      group: "",
      party: "不分",
      isVip: false,
      tableId: "",
      seatNo: null,
      notes: "",
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return project.guests;
    return project.guests.filter((g) => {
      return (
        g.name.toLowerCase().includes(needle) ||
        (g.group || "").toLowerCase().includes(needle) ||
        (g.phone || "").toLowerCase().includes(needle)
      );
    });
  }, [project.guests, q]);

  function openCreate() {
    setEditing(null);
    form.reset({
      name: "",
      phone: "",
      group: "",
      party: "不分",
      isVip: false,
      tableId: "",
      seatNo: null,
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEdit(g: Guest) {
    setEditing(g);
    form.reset({
      name: g.name,
      phone: g.phone || "",
      group: g.group || "",
      party: g.party || "不分",
      isVip: !!g.isVip,
      tableId: g.assignment?.tableId || "",
      seatNo: g.assignment?.seatNo ?? null,
      notes: g.notes || "",
    });
    setDialogOpen(true);
  }

  function buildAssignment(values: GuestForm, guestIdForEdit?: string) {
    const tableId = (values.tableId || "").trim();
    if (!tableId) return null;

    const table = project.tables.find((t) => t.id === tableId);
    if (!table) {
      toast.error("找不到该桌次");
      return null;
    }

    // Determine seat
    let seatNo = values.seatNo;
    const seated = guestsByTable(project, tableId).filter((g) => g.id !== guestIdForEdit);
    const taken = new Set(seated.map((g) => g.assignment?.seatNo).filter(Boolean));

    if (seatNo == null) {
      const nextSeat = nextEmptySeat(table, seated);
      if (!nextSeat) {
        toast.error("这桌已经坐满了");
        return null;
      }
      seatNo = nextSeat;
    }

    if (seatNo < 1 || seatNo > table.capacity) {
      toast.error(`座号必须在 1~${table.capacity}`);
      return null;
    }

    if (taken.has(seatNo)) {
      toast.error("该座号已有人");
      return null;
    }

    return { tableId, seatNo };
  }

  function onSubmit(values: GuestForm) {
    if (!editing) {
      const assignment = buildAssignment(values);
      const next = createGuest({
        name: values.name,
        phone: values.phone,
        group: values.group,
        party: values.party,
        isVip: values.isVip,
        notes: values.notes,
        assignment,
      });
      setProject({ ...project, guests: [next, ...project.guests] });
      toast.success("已新增来宾");
    } else {
      const assignment = buildAssignment(values, editing.id);
      const updated: Guest = {
        ...editing,
        name: values.name.trim(),
        phone: values.phone || "",
        group: values.group || "",
        party: values.party,
        isVip: values.isVip,
        notes: values.notes || "",
        assignment,
      };
      setProject({
        ...project,
        guests: project.guests.map((g) => (g.id === editing.id ? updated : g)),
      });
      toast.success("已更新来宾资料");
    }

    setDialogOpen(false);
  }

  function removeGuest(id: string) {
    setProject({ ...project, guests: project.guests.filter((g) => g.id !== id) });
    toast.success("已删除");
  }

  async function handleImport(file: File) {
    const tid = toast.loading("正在导入…");
    try {
      const rows = await parseGuestsCsv(file);
      const created: Guest[] = [];

      for (const r of rows) {
        const name = (r.name || "").trim();
        if (!name) continue;
        const party = (String(r.party || "").trim() as any) || "不分";
        const normalizedParty = party === "男方" || party === "女方" ? party : "不分";

        // seat import (optional)
        const tableRaw = String((r as any)["桌号"] || "").trim();
        const seatRaw = String((r as any)["座号"] || "").trim();

        let assignment: any = null;
        if (tableRaw) {
          const table = project.tables.find((t) => t.id === tableRaw || t.name === tableRaw);
          if (table) {
            const seated = guestsByTable(project, table.id);
            const taken = new Set(seated.map((g) => g.assignment?.seatNo).filter(Boolean) as number[]);

            let seatNo: number | null = null;
            const parsedSeat = Number(seatRaw);
            if (seatRaw && Number.isFinite(parsedSeat)) seatNo = Math.floor(parsedSeat);

            if (seatNo == null) {
              seatNo = nextEmptySeat(table, seated);
            }

            if (seatNo != null && seatNo >= 1 && seatNo <= table.capacity && !taken.has(seatNo)) {
              assignment = { tableId: table.id, seatNo };
            }
          }
        }

        created.push(
          createGuest({
            name,
            phone: String(r.phone || ""),
            group: String(r.group || ""),
            party: normalizedParty,
            isVip: normalizeBool((r as any)["贵宾"] ?? (r as any).isVip),
            notes: String(r.notes || ""),
            assignment,
          })
        );
      }

      if (!created.length) {
        toast.error("没有可导入的数据（至少需要 name 列）", { id: tid });
        return;
      }

      setProject({ ...project, guests: [...created, ...project.guests] });
      toast.success(`导入完成：${created.length} 位来宾`, { id: tid });
    } catch (e: any) {
      toast.error(`导入失败：${e?.message || "未知错误"}`, { id: tid });
    }
  }

  function exportCsv() {
    const rows = guestsToCsvRows(project.guests, (tableId) => {
      return project.tables.find((t) => t.id === tableId)?.name || tableId;
    });
    const csv = "\ufeff" + stringifyCsv(rows); // UTF-8 BOM: Excel更容易正确识别中文
    downloadText(
      `来宾名单_${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
    toast.success("已导出 CSV");
  }

  function downloadCsvTemplate() {
    const template = "\ufeff" + stringifyCsv([
      {
        name: "王小明",
        phone: "91234567",
        group: "男方亲友",
        party: "男方",
        桌号: "",
        座号: "",
        贵宾: "no",
        notes: "未分桌（你也可以先留空，之后再排）"
      },
      {
        name: "陈美丽",
        phone: "98765432",
        group: "女方亲友",
        party: "女方",
        桌号: "",
        座号: "",
        贵宾: "yes",
        notes: "贵宾（建议先新增桌次后再分配座位）"
      },
    ]);

    downloadText(
      "来宾名单_导入模板.csv",
      template,
      "text/csv;charset=utf-8"
    );
    toast.success("已下载 CSV 模板");
  }

  function exportLookupPage() {
    const html = buildLookupHtml(project as any, {
      title: `${project.event.name || "婚礼"} · 来宾座位查询`,
      allowPhoneLast4: lookupAllowPhoneLast4,
    });
    downloadText(
      `来宾自助查询页_${new Date().toISOString().slice(0, 10)}.html`,
      html,
      "text/html;charset=utf-8"
    );
    toast.success("已导出来宾自助查询页（HTML）");
    setLookupDialogOpen(false);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">来宾名单</h1>
        <p className="text-muted-foreground">
          支持新增/编辑/删除、CSV 导入导出。下一步我会把“分组管理”和“Excel 直读”也补上。
        </p>
      </header>

      <Card className="ledger-border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="font-display text-2xl">名单</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImport(f);
                  e.currentTarget.value = "";
                }}
              />

              <Button
                data-tour="guest-import"
                variant="outline"
                disabled={locked}
                onClick={() => {
                  if (locked) return toast.error("活动已锁定，无法导入名单");
                  fileRef.current?.click();
                }}
              >
                导入 CSV
              </Button>
              <Button variant="outline" onClick={downloadCsvTemplate}>
                下载模板
              </Button>
              <Button variant="outline" onClick={exportCsv}>
                导出 CSV
              </Button>
              <Dialog open={lookupDialogOpen} onOpenChange={setLookupDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">导出查询页（HTML）</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[560px]">
                  <DialogHeader>
                    <DialogTitle className="font-display text-2xl">导出查询页设置</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
                      <div>
                        <div className="text-sm font-medium">允许用电话后 4 位查询</div>
                        <div className="text-xs text-muted-foreground">
                          适合同名情况；若更在意隐私可关闭。
                        </div>
                      </div>
                      <Switch
                        checked={lookupAllowPhoneLast4}
                        onCheckedChange={setLookupAllowPhoneLast4}
                      />
                    </div>

                    <div className="text-xs text-muted-foreground leading-relaxed">
                      导出后会得到一个单独的 HTML 文件。你把它上传到 GitHub Pages，再用【来宾二维码】生成二维码给来宾扫描。
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setLookupDialogOpen(false)}>
                      取消
                    </Button>
                    <Button className="bg-primary text-primary-foreground" onClick={exportLookupPage}>
                      立即导出
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Separator orientation="vertical" className="mx-1 h-6" />
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    data-tour="guest-add"
                    className="bg-primary text-primary-foreground"
                    onClick={() => {
                      if (locked) return toast.error("活动已锁定，无法新增/编辑名单");
                      openCreate();
                    }}
                    disabled={locked}
                  >
                    新增来宾
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[560px]">
                  <DialogHeader>
                    <DialogTitle className="font-display text-2xl">
                      {editing ? "编辑来宾" : "新增来宾"}
                    </DialogTitle>
                  </DialogHeader>

                  <form
                    className="space-y-4"
                    onSubmit={form.handleSubmit(onSubmit)}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">姓名 *</div>
                        <Input {...form.register("name")} />
                        {form.formState.errors.name && (
                          <div className="text-xs text-destructive">
                            {form.formState.errors.name.message}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">电话</div>
                        <Input {...form.register("phone")} />
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">分组（家庭/单位）</div>
                        <Input {...form.register("group")} placeholder="如：男方亲友 / 同事" />
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">阵营</div>
                        <div className="flex gap-2">
                          {(["男方", "女方", "不分"] as const).map((p) => (
                            <Button
                              key={p}
                              type="button"
                              variant={form.watch("party") === p ? "default" : "outline"}
                              onClick={() => form.setValue("party", p)}
                            >
                              {p}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2 md:col-span-2">
                        <div className="text-sm text-muted-foreground">桌号（可选）</div>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={form.watch("tableId")}
                          onChange={(e) => {
                            const v = e.target.value;
                            form.setValue("tableId", v);
                            // 如果换桌，默认让座号为空，让系统自动找下一个空位
                            form.setValue("seatNo", null);
                          }}
                        >
                          <option value="">未分桌</option>
                          {project.tables.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}（{t.capacity}人）
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-muted-foreground">
                          不填座号会自动安排该桌的下一个空位。
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">座号（可选）</div>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={form.watch("seatNo") ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            form.setValue("seatNo", raw === "" ? null : Number(raw));
                          }}
                          placeholder="留空=自动"
                          disabled={!form.watch("tableId")}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={form.watch("isVip")}
                        onCheckedChange={(v) => form.setValue("isVip", !!v)}
                      />
                      <span className="text-sm">贵宾（优先安排主桌/贵宾桌）</span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">备注</div>
                      <Textarea rows={3} {...form.register("notes")} />
                    </div>

                    <DialogFooter className="gap-2">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        取消
                      </Button>
                      <Button type="submit" className="bg-primary text-primary-foreground">
                        保存
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-accent text-accent-foreground">{project.guests.length} 人</Badge>
              <span className="text-xs text-muted-foreground">（显示 {filtered.length} 人）</span>
            </div>
            <div className="w-full md:w-[360px]">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索姓名 / 分组 / 电话"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">姓名</TableHead>
                  <TableHead>分组</TableHead>
                  <TableHead className="w-[110px]">阵营</TableHead>
                  <TableHead className="w-[120px]">电话</TableHead>
                  <TableHead className="w-[140px]">桌号/座号</TableHead>
                  <TableHead className="w-[90px]">贵宾</TableHead>
                  <TableHead className="w-[160px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      还没有资料。可以先“导入 CSV”，或者点“新增来宾”。
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{g.name}</span>
                          {g.checkIn?.status === "checked_in" && (
                            <Badge variant="secondary">已签到</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{g.group || "—"}</TableCell>
                      <TableCell>{g.party || "不分"}</TableCell>
                      <TableCell className="text-muted-foreground">{g.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {g.assignment
                          ? `${project.tables.find((t) => t.id === g.assignment?.tableId)?.name || g.assignment.tableId} / ${g.assignment.seatNo}`
                          : "未分桌"}
                      </TableCell>
                      <TableCell>
                        {g.isVip ? <Badge className="bg-accent text-accent-foreground">VIP</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={locked}
                            onClick={() => {
                              if (locked) return toast.error("活动已锁定，无法编辑名单");
                              openEdit(g);
                            }}
                          >
                            编辑
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={locked}
                            onClick={() => {
                              if (locked) return toast.error("活动已锁定，无法删除名单");
                              removeGuest(g.id);
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-xs text-muted-foreground leading-relaxed">
            CSV 表头建议：name, phone, group, party, 桌号, 座号, 贵宾, notes（贵宾用 yes/no；桌号/座号可先留空，之后再到【座位编排】新增桌次并分配）。
            <br />
            目前导入只支持 CSV；若你一定要 Excel（.xlsx），我可以下一版加“选择并转换”。
            
            
            你要给来宾自助查询座位的话：请点上方“导出查询页（HTML）”，那会生成一个**单独网页文件**，上传到 GitHub Pages 后来宾就能用手机打开查询。
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
