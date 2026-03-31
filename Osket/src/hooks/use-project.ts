import { useProjectCtx } from "@/contexts/ProjectContext";

// Backward-compatible hook name
export function useProject() {
  return useProjectCtx();
}
