// 接待台锁定模式：用于另一台平板给来宾看，避免误入后台其它页面。
import { useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

import KioskPage from "@/pages/Kiosk";

const LOCK_KEY = "wedding-ledger.kioskLocked";
const PIN_KEY = "wedding-ledger.kioskPin";

function getPin() {
  return localStorage.getItem(PIN_KEY) || "0000";
}

export function setKioskLocked(next: boolean) {
  localStorage.setItem(LOCK_KEY, next ? "1" : "0");
}

export function isKioskLocked() {
  return localStorage.getItem(LOCK_KEY) === "1";
}

export default function KioskLockPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setKioskLocked(true);
  }, []);

  function tryUnlock() {
    const input = window.prompt("输入PIN以解锁（默认 0000）");
    if (input === null) return;
    if (input.trim() !== getPin()) {
      toast.error("PIN 不正确");
      return;
    }
    setKioskLocked(false);
    toast.success("已解锁");
    setLocation("/kiosk");
  }

  return (
    <div className="min-h-screen w-full paper-noise">
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <div className="rounded-2xl bg-card text-card-foreground ledger-border">
          <div className="flex items-center justify-end border-b border-border p-3">
            <button
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={tryUnlock}
              type="button"
            >
              解锁
            </button>
          </div>
          <div className="p-4 md:p-8">
            <KioskPage />
          </div>
        </div>
      </div>
    </div>
  );
}
