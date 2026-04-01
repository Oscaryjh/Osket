import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Banquet, ProjectData } from "@/lib/model";
import { loadProject, saveProject } from "@/lib/storage";
import { cloudLoadProject, isCloudEnabled } from "@/lib/cloud";

export type ProjectContextValue = {
  project: ProjectData;
  setProject: React.Dispatch<React.SetStateAction<ProjectData>>;

  activeBanquet: Banquet;
  setActiveBanquetId: (id: string) => void;
  updateActiveBanquet: (updater: (b: Banquet) => Banquet) => void;

  isDirty: boolean;
  saveNow: () => boolean;
};

const Ctx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children, venueId }: { children: React.ReactNode; venueId?: string | null }) {
  const vid = (venueId || "default").trim() || "default";
  const cloud = isCloudEnabled(venueId);
  const [project, setProject] = useState<ProjectData>(() => loadProject(vid));
  const lastSaved = useRef<string>("");
  const [isDirty, setIsDirty] = useState(false);

  const activeBanquet = useMemo(() => {
    const b = project.banquets.find((x) => x.id === project.activeBanquetId);
    return (b || project.banquets[0]) as Banquet;
  }, [project]);

  // initial load from cloud when configured (fallback to local)
  useEffect(() => {
    if (!cloud) {
      setProject(loadProject(vid));
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const p = await cloudLoadProject(String(venueId));
        if (!alive) return;
        setProject(p);
      } catch (e) {
        console.warn("cloudLoadProject failed, fallback to local", e);
        if (!alive) return;
        setProject(loadProject(vid));
      }
    })();
    return () => {
      alive = false;
    };
  }, [cloud, vid, venueId]);

  // auto-save local backup (even in cloud mode)
  useEffect(() => {
    const serialized = JSON.stringify(project);
    if (serialized === lastSaved.current) {
      setIsDirty(false);
      return;
    }

    setIsDirty(true);

    const t = window.setTimeout(() => {
      try {
        saveProject(project, vid);
        lastSaved.current = serialized;
        setIsDirty(false);
      } catch {
        setIsDirty(true);
      }
    }, 350);

    return () => window.clearTimeout(t);
  }, [project, vid]);

  const saveNow = () => {
    try {
      const serialized = JSON.stringify(project);
      saveProject(project, vid);
      lastSaved.current = serialized;
      setIsDirty(false);
      return true;
    } catch {
      setIsDirty(true);
      return false;
    }
  };

  const setActiveBanquetId = (id: string) => {
    setProject((prev) => ({ ...prev, activeBanquetId: id }));
  };

  const updateActiveBanquet = (updater: (b: Banquet) => Banquet) => {
    setProject((prev) => {
      const b = prev.banquets.find((x) => x.id === prev.activeBanquetId) || prev.banquets[0];
      if (!b) return prev;
      return {
        ...prev,
        banquets: prev.banquets.map((x) => (x.id === b.id ? updater(x) : x)),
      };
    });
  };

  const value = useMemo<ProjectContextValue>(
    () => ({
      project,
      setProject,
      activeBanquet: activeBanquet as Banquet,
      setActiveBanquetId,
      updateActiveBanquet,
      isDirty,
      saveNow,
    }),
    [project, activeBanquet, isDirty]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjectCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProject must be used within ProjectProvider");
  return v;
}
