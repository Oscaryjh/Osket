import { useMemo } from "react";
import { toast } from "sonner";

import { loadVenues, saveSession, requireVenueId } from "@/lib/venue-auth";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function VenueSwitcher() {
  const venues = useMemo(() => loadVenues(), []);
  const activeId = requireVenueId();
  const active = venues.find((v) => v.id === activeId) || null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          {active ? active.name : "选择场地"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[260px]">
        <DropdownMenuLabel>当前场地</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {venues.length === 0 ? (
          <div className="px-2 py-2 text-sm text-muted-foreground">还没有场地账号</div>
        ) : (
          venues.map((v) => (
            <DropdownMenuItem
              key={v.id}
              onClick={() => {
                saveSession({ venueId: v.id });
                toast.success(`已切换：${v.name}`);
                window.location.reload();
              }}
            >
              {v.name} ({v.phone})
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            saveSession(null);
            window.location.hash = "#/login";
            window.location.reload();
          }}
        >
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
