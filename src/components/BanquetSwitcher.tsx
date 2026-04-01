// Design reminder (宴会账本): 像“翻到另一场宴会的账本”。
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useProject } from "@/hooks/use-project";
import { createBanquet } from "@/lib/storage";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function BanquetSwitcher() {
  const { project, setProject, activeBanquet, setActiveBanquetId, updateActiveBanquet } = useProject();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState(activeBanquet?.event.name || "");

  const options = useMemo(
    () =>
      project.banquets.map((b) => ({
        id: b.id,
        name: b.event.name || "未命名宴会",
        guests: b.guests.length,
      })),
    [project.banquets]
  );

  function add() {
    const b = createBanquet((newName.trim() || "新的宴会"), 10);
    setProject({
      ...project,
      activeBanquetId: b.id,
      banquets: [...project.banquets, b],
    });
    toast.success("已新增宴会");
    setNewName("");
    setOpen(false);
  }

  function remove(id: string) {
    if (project.banquets.length <= 1) {
      toast.error("至少要保留 1 场宴会");
      return;
    }
    if (!confirm("确定要删除这场宴会吗？该宴会的来宾/座位/签到都会一起删除。")) return;

    const nextBanquets = project.banquets.filter((b) => b.id !== id);
    const nextActive = project.activeBanquetId === id ? nextBanquets[0].id : project.activeBanquetId;
    setProject({ ...project, banquets: nextBanquets, activeBanquetId: nextActive });
    toast.success("已删除宴会");
  }

  // keep rename input in sync
  const activeId = activeBanquet?.id || "";
  useEffect(() => {
    setRenameName(activeBanquet?.event.name || "");
  }, [activeId, activeBanquet?.event.name]);

  function rename() {
    const name = renameName.trim();
    if (!name) {
      toast.error("宴会名称不能为空");
      return;
    }
    updateActiveBanquet((b) => ({ ...b, event: { ...b.event, name } }));
    toast.success("已更新宴会名称");
    setRenameOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={activeBanquet?.id || ""} onValueChange={(v) => setActiveBanquetId(v)}>
        <SelectTrigger className="h-9 w-[220px]">
          <SelectValue placeholder="选择宴会" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}（{o.guests}人）
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            新增宴会
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">新增宴会</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">宴会名称</div>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如：午宴 / 晚宴 / A厅" />
            <div className="text-xs text-muted-foreground">新增后会有独立的名单、桌次与签到。</div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={add}>
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeBanquet ? (
        <>
          <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                改名
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">修改宴会名称</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">宴会名称</div>
                <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} />
                <div className="text-xs text-muted-foreground">例如：午宴 / 晚宴 / A厅 / B厅</div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setRenameOpen(false)}>
                  取消
                </Button>
                <Button className="bg-primary text-primary-foreground" onClick={rename}>
                  保存
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => remove(activeBanquet.id)}
            title="删除当前宴会"
          >
            删除
          </Button>
        </>
      ) : null}

      <Badge className="bg-accent text-accent-foreground">当前：{activeBanquet?.event.name || "—"}</Badge>
    </div>
  );
}
