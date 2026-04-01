import { supabase } from "@/lib/supabase";

type RpcResult = { ok: true; data: any } | { ok: false; code: string; message: string; meta?: any };

export async function callRpc<T = any>(fn: string, args: Record<string, any>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const e: any = new Error(error.message || "RPC transport error");
    e.code = "RPC_TRANSPORT";
    e.meta = error;
    throw e;
  }
  const r = data as RpcResult;
  if (!r) throw new Error("Empty RPC response");
  if (r.ok === false) {
    const e: any = new Error(r.message || r.code || "RPC error");
    e.code = r.code;
    e.meta = r.meta;
    throw e;
  }
  return r.data as T;
}

export function rpcMessageFromError(e: any) {
  const code = e?.code;
  if (!code) return e?.message || "操作失败";
  if (code === "INSUFFICIENT_CREDIT") {
    const shortage = e?.meta?.shortage;
    return shortage != null ? `额度不足，还差 RM ${shortage}` : "额度不足，无法扣费";
  }
  if (code === "INVALID_STATE") return e?.message || "当前状态不允许此操作";
  if (code === "INVALID_PIN") return "管理员 PIN 不正确";
  if (code === "REASON_REQUIRED") return "原因必填";
  if (code === "SETTLED_ALREADY") return "平台已结算，如需更正请联系平台处理";
  if (code === "FORBIDDEN") return "权限不足";
  if (code === "UNAUTHENTICATED") return "请先登录";
  return e?.message || code || "操作失败";
}
