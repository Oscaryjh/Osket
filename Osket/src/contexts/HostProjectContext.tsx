import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Banquet, ProjectData } from "@/lib/model";
import { loadProject, saveProject } from "@/lib/storage";

export type HostProjectContextValue = {
  venueId: string;
  project: ProjectData;
  setProject: React.Dispatch<React.SetStateAction<ProjectData>>;

  activeBanquet: Banquet;
  setActiveBanquetId: (id: string) => void;
  updateActiveBanquet: (updater: (b: Banquet) => Banquet) => void;

  isDirty: boolean;
  saveNow: () => boolean;
};

const Ctx = createContext<HostProjectContextValue | null>(null);

export function HostProjectProvider({ venueId, children }: { venueId: string; children: React.ReactNode }) {
  const [project, setProject] = useState<ProjectData>(() => loadProject(venueId));
  const lastSaved = useRef<string>("");
  const [isDirty, setIsDirty] = useState(false);

  const activeBanquet = useMemo(() => {
    const b = project.banquets.find((x) => x.id === project.activeBanquetId);
    return (b || project.banquets[0]) as Banquet;
  }, [project]);

  useEffect(() => {
    const serialized = JSON.stringify(project);
    if (serialized === lastSaved.current) {
      setIsDirty(false);
      return;
    }

    setIsDirty(true);

    const t = window.setTimeout(() => {
      try {
        saveProject(project, venueId);
        lastSaved.current = serialized;
        setIsDirty(false);
      } catch {
        setIsDirty(true);
      }
    }, 350);

    return () => window.clearTimeout(t);
  }, [project, venueId]);

  const saveNow = () => {
    try {
      const serialized = JSON.stringify(project);
      saveProject(project, venueId);
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

  const value = useMemo<HostProjectContextValue>(
    () => ({
      venueId,
      project,
      setProject,
      activeBanquet: activeBanquet as Banquet,
      setActiveBanquetId,
      updateActiveBanquet,
      isDirty,
      saveNow,
    }),
    [venueId, project, activeBanquet, isDirty]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHostProjectCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHostProjectCtx must be used within HostProjectProvider");
  return v;
}
