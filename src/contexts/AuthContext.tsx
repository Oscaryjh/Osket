import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

export type AppRole = "platform" | "venue_owner" | "host_admin" | "host_staff";

export type Profile = {
  user_id: string;
  role: AppRole;
  venue_id: string | null;
  phone: string | null;
};

type AuthContextValue = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthContextValue | null>(null);

async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, role, venue_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("fetch profile error", error);
    return null;
  }
  return (data as any) || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const user = session?.user || null;

  const refreshProfile = async () => {
    if (!supabase || !user) {
      setProfile(null);
      return;
    }
    const p = await fetchMyProfile(user.id);
    setProfile(p);
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setProfile(null);
      return;
    }
    void refreshProfile();
  }, [ready, user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      session,
      user,
      profile,
      refreshProfile,
      signOut,
    }),
    [ready, session, user, profile]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
