// Design reminder (宴会账本): 用少量高对比与"金色章"做重点。
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useMemo } from "react";
import { useProject } from "@/hooks/use-project";

export default function Dashboard() {
  const { activeBanquet: project } = useProject();

  const kpi = useMemo(() => {
    const total = project?.guests.length || 0;
    const seated = project?.guests.filter((g) => !!g.assignment).length || 0;
    const unseated = total - seated;
    const checkedIn = project?.guests.filter((g) => g.checkIn?.status === "checked_in").length || 0;

    return { total, seated, unseated, checkedIn };
  }, [project]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display page-title">总览</h1>
        <p className="text-muted-foreground page-subtitle">
          这里会显示人数、分桌进度、签到进度。下一步我会把数据接上本地存储。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        {([
          { label: "来宾总数", value: kpi.total },
          { label: "已分桌", value: kpi.seated },
          { label: "未分桌", value: kpi.unseated },
          { label: "已签到", value: kpi.checkedIn },
        ] as const).map((item) => (
          <Card key={item.label} className="ledger-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-baseline justify-between">
              <div className="font-display text-3xl">{item.value}</div>
              <Badge className="bg-accent text-accent-foreground">本地</Badge>
            </CardContent>
          </Card>
        ))}
      </div>


      <Card className="ledger-border">
        <CardHeader>
          <CardTitle className="font-display text-2xl">快速开始</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          建议流程：先在【来宾名单】导入 CSV → 到【座位编排】设置桌数与每桌人数 →
          执行“规则辅助分桌” → 现场到【签到入场】快速搜索签到 →
          最后到【打印输出】生成座位表与名单。
        </CardContent>
      </Card>
    </div>
  );
}
