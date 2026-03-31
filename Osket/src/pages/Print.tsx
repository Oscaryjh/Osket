// Design reminder (宴会账本): 打印要干净、黑白也清楚。
import { useMemo, useState } from "react";

import { useProject } from "@/hooks/use-project";
import { guestsByTable } from "@/lib/seating";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PrintPage() {
  const { activeBanquet: project } = useProject();
  const [tab, setTab] = useState("tables");

  const tableViews = useMemo(() => {
    return project.tables.map((t) => ({
      table: t,
      guests: guestsByTable(project, t.id),
    }));
  }, [project]);

  const flatList = useMemo(() => {
    return [...project.guests].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans"));
  }, [project.guests]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">打印输出</h1>
        <p className="text-muted-foreground">
          这里提供“桌次座位表 / 总名单”。点右上角打印即可。建议在打印对话框里选“背景图形关闭”，更省墨。
        </p>
      </header>

      <div className="flex justify-end">
        <Button className="bg-primary text-primary-foreground" onClick={() => window.print()}>
          打印
        </Button>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-card { box-shadow: none !important; border: none !important; }
          .print-page { break-inside: avoid; page-break-inside: avoid; }
          a { color: black !important; text-decoration: none !important; }
        }
      `}</style>

      <Card className="ledger-border print-card">
        <CardHeader className="no-print">
          <CardTitle className="font-display text-2xl">选择输出</CardTitle>
        </CardHeader>
        <CardContent className={tab === "tables" ? "space-y-6" : "space-y-4"}>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="no-print">
              <TabsTrigger value="tables">桌次座位表</TabsTrigger>
              <TabsTrigger value="list">总名单</TabsTrigger>
            </TabsList>

            <TabsContent value="tables" className="mt-6">
              <div className="grid gap-6">
                {tableViews.map(({ table, guests }) => (
                  <div key={table.id} className="print-page rounded-xl border border-border p-5">
                    <div className="flex items-baseline justify-between">
                      <div className="font-display text-2xl">{table.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {guests.length}/{table.capacity}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {Array.from({ length: table.capacity }).map((_, i) => {
                        const seatNo = i + 1;
                        const g = guests.find((x) => x.assignment?.seatNo === seatNo);
                        return (
                          <div
                            key={seatNo}
                            className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                          >
                            <div className="text-sm text-muted-foreground">{seatNo}</div>
                            <div className="text-sm font-medium">{g ? g.name : "—"}</div>
                            <div className="text-xs text-muted-foreground">{g?.group || ""}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-6">
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left">姓名</th>
                      <th className="p-3 text-left">分组</th>
                      <th className="p-3 text-left">桌号/座号</th>
                      <th className="p-3 text-left">签到</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatList.map((g) => (
                      <tr key={g.id} className="border-t border-border">
                        <td className="p-3 font-medium">{g.name}</td>
                        <td className="p-3 text-muted-foreground">{g.group || "—"}</td>
                        <td className="p-3 text-muted-foreground">
                          {g.assignment ? `${g.assignment.tableId} / ${g.assignment.seatNo}` : "未分桌"}
                        </td>
                        <td className="p-3">{g.checkIn?.status === "checked_in" ? "已签到" : "—"}</td>
                      </tr>
                    ))}
                    {flatList.length === 0 ? (
                      <tr>
                        <td className="p-8 text-center text-muted-foreground" colSpan={4}>
                          目前没有来宾资料。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
