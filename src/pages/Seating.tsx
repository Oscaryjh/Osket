// Design reminder (宴会账本): 左侧像"候场名单"，右侧像"桌次账页"。
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { nanoid } from "nanoid";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";

import type { Guest, Table as TableModel } from "@/lib/model";
import { useProject } from "@/hooks/use-project";
import { assignToTable, autoSeat, guestsByTable, unassign, unassignedGuests } from "@/lib/seating";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

function DraggableGuest({ guest, prefix }: { guest: Guest; prefix?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `guest:${guest.id}`,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="select-none cursor-grab active:cursor-grabbing rounded-lg border border-border bg-card px-3 py-2 text-sm ledger-border"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium">
          {prefix ? <span className="mr-1 text-muted-foreground">{prefix}</span> : null}
          {guest.name}
          {guest.isVip ? (
            <Badge className="ml-2 bg-accent text-accent-foreground">VIP</Badge>
          ) : null}
        </div>
        <div className="text-[11px] text-muted-foreground">{guest.group || "—"}</div>
      </div>
    </div>
  );
}

function DroppableArea({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={
        isOver
          ? "rounded-xl bg-accent/35 p-3 transition"
          : "rounded-xl bg-muted/30 p-3 transition"
      }
    >
      {children}
    </div>
  );
}

function TableCard({
  table,
  seated,
  onOpenEdit,
  onDelete,
}: {
  table: TableModel;
  seated: Guest[];
  onOpenEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="ledger-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl">{table.name}</span>
            {table.locked ? <Badge variant="secondary">锁定</Badge> : null}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onOpenEdit}>
              设置
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={onDelete}
            >
              删除
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {seated.length}/{table.capacity}
          </span>
          <span>拖来宾到这桌即可自动排下一个空位</span>
        </div>

        <DroppableArea id={`table:${table.id}`}>
          <div className="grid gap-2">
            {seated.length === 0 ? (
              <div className="text-sm text-muted-foreground">这桌目前是空的。</div>
            ) : (
              seated.map((g) => (
                <DraggableGuest key={g.id} guest={g} prefix={`${g.assignment?.seatNo}.`} />
              ))
            )}
          </div>
        </DroppableArea>
      </CardContent>
    </Card>
  );
}

export default function SeatingPage() {
  const { activeBanquet: project, updateActiveBanquet } = useProject();
  // 重要：所有写操作都用 updateActiveBanquet(b => ...) 以确保写入“当前选中的宴会”
  const setProject = (updater: any) => updateActiveBanquet(updater);
  const [activeGuest, setActiveGuest] = useState<Guest | null>(null);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableModel | null>(null);
  const [tmpName, setTmpName] = useState("");
  const [tmpCap, setTmpCap] = useState(10);
  const [tmpLocked, setTmpLocked] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const pool = useMemo(() => unassignedGuests(project), [project]);

  const tableGuests = useMemo(() => {
    const m = new Map<string, Guest[]>();
    for (const t of project.tables) m.set(t.id, guestsByTable(project, t.id));
    return m;
  }, [project]);

  function openEditTable(t: TableModel) {
    setEditingTable(t);
    setTmpName(t.name);
    setTmpCap(t.capacity);
    setTmpLocked(!!t.locked);
    setTableDialogOpen(true);
  }

  function saveTable() {
    if (!editingTable) return;
    const name = tmpName.trim() || editingTable.name;
    const cap = Math.max(1, Math.min(30, Math.floor(tmpCap || 10)));

    setProject((b: any) => ({
      ...b,
      tables: b.tables.map((t: any) =>
        t.id === editingTable.id ? { ...t, name, capacity: cap, locked: tmpLocked } : t
      ),
    }));
    toast.success("已更新桌次设置");
    setTableDialogOpen(false);
  }

  function addTable() {
    if (project.event.locked) {
      toast.error("活动已锁定，无法新增桌次");
      return;
    }
    const id = `T_${nanoid(6)}`;
    const seq = project.tables.length + 1;
    const table: TableModel = {
      id,
      name: `A${String(seq).padStart(2, "0")}`,
      capacity: project.event.defaultTableCapacity || 10,
      locked: false,
    };
    setProject((b: any) => ({ ...b, tables: [...b.tables, table] }));
    toast.success("已新增桌次");
  }

  function removeTable(tableId: string) {
    if (project.event.locked) {
      toast.error("活动已锁定，无法删除桌次");
      return;
    }
    setProject((b: any) => {
      // move everyone in this table back to pool
      const nextGuests = b.guests.map((g: any) =>
        g.assignment?.tableId === tableId ? { ...g, assignment: null } : g
      );
      return {
        ...b,
        tables: b.tables.filter((t: any) => t.id !== tableId),
        guests: nextGuests,
      };
    });
    toast.success("已删除桌次（该桌来宾已退回未分桌）");
  }

  function handleDragEnd(event: DragEndEvent) {
    if (project.event.locked) {
      setActiveGuest(null);
      toast.error("活动已锁定，无法调整分桌");
      return;
    }
    const { active, over } = event;
    setActiveGuest(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (!activeId.startsWith("guest:")) return;
    const guestId = activeId.replace("guest:", "");

    if (overId === "pool") {
      setProject((b: any) => unassign(b, guestId));
      return;
    }

    if (overId.startsWith("table:")) {
      const tableId = overId.replace("table:", "");
      const table = project.tables.find((t) => t.id === tableId);
      if (!table) return;
      const seated = guestsByTable(project, tableId);
      if (seated.length >= table.capacity) {
        toast.error("这桌已经坐满了");
        return;
      }
      setProject((b: any) => assignToTable(b, guestId, tableId));
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">座位编排</h1>
        <p className="text-muted-foreground page-subtitle">
          现在支持拖拽把来宾丢到指定桌；并提供“规则辅助分桌”（VIP 优先 + 同分组尽量同桌 + 锁定桌不挪动）。
          {project.event.locked ? "（活动已锁定：此页只读）" : ""}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button data-tour="table-add" variant="outline" onClick={addTable}>
          新增桌次
        </Button>
        <Button
          className="bg-primary text-primary-foreground"
          disabled={!!project.event.locked}
          onClick={() => {
            if (project.event.locked) return toast.error("活动已锁定，无法分桌");
            setProject((b: any) => autoSeat(b));
            toast.success("已执行规则辅助分桌");
          }}
        >
          规则辅助分桌
        </Button>
        <Button
          variant="outline"
          disabled={!!project.event.locked}
          onClick={() => {
            if (project.event.locked) return toast.error("活动已锁定，无法清除分桌");
            setProject((b: any) => {
              // clear non-locked assignments
              const lockedIds = new Set(b.tables.filter((t: any) => t.locked).map((t: any) => t.id));
              return {
                ...b,
                guests: b.guests.map((g: any) =>
                  g.assignment && !lockedIds.has(g.assignment.tableId) ? { ...g, assignment: null } : g
                ),
              };
            });
            toast.success("已清除（非锁定桌）分桌");
          }}
        >
          清除分桌
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e) => {
          const id = String(e.active.id);
          if (!id.startsWith("guest:")) return;
          const guestId = id.replace("guest:", "");
          setActiveGuest(project.guests.find((g) => g.id === guestId) || null);
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <Card className="ledger-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="font-display text-2xl">未分桌</span>
                <Badge className="bg-accent text-accent-foreground">{pool.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DroppableArea id="pool">
                <div data-tour="pool" />
                <div className="grid gap-2">
                  {pool.length === 0 ? (
                    <div className="text-sm text-muted-foreground">太好了，全部都安排了。</div>
                  ) : (
                    pool.map((g) => <DraggableGuest key={g.id} guest={g} />)
                  )}
                </div>
              </DroppableArea>
              <div className="mt-3 text-xs text-muted-foreground">
                小技巧：把桌里的人拖回这里即可“退回未分桌”。
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {project.tables.length === 0 ? (
              <Card className="ledger-border">
                <CardContent className="py-10 text-center text-muted-foreground">
                  还没有桌次。点上方“新增桌次”。
                </CardContent>
              </Card>
            ) : (
              project.tables.map((t) => (
                <div key={t.id}>
                  <TableCard
                    table={t}
                    seated={tableGuests.get(t.id) || []}
                    onOpenEdit={() => openEditTable(t)}
                    onDelete={() => removeTable(t.id)}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <DragOverlay>
          {activeGuest ? (
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm ledger-border">
              {activeGuest.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">桌次设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">桌名</div>
              <Input value={tmpName} onChange={(e) => setTmpName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">容量（每桌人数）</div>
              <Input
                type="number"
                value={tmpCap}
                onChange={(e) => setTmpCap(Number(e.target.value))}
                min={1}
                max={30}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <div className="text-sm font-medium">锁定这桌</div>
                <div className="text-xs text-muted-foreground">
                  规则辅助分桌时，不会移动这桌已安排的人。
                </div>
              </div>
              <Switch checked={tmpLocked} onCheckedChange={setTmpLocked} />
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground leading-relaxed">
              说明：目前“拖拽到桌”会自动塞进该桌的下一个空位；后续我可以加“指定座号”与“桌内拖拽换位”。
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTableDialogOpen(false)}>
              取消
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={saveTable}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
