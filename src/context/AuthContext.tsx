import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types/supabase";

export type TelegramWidgetUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  needsOnboarding: boolean;
  signInWithTelegram: (widgetUser: TelegramWidgetUser) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function exchangeTelegramSession(widgetUser: TelegramWidgetUser) {
  const { data, error } = await supabase.functions.invoke("telegram-auth", {
    body: { widgetUser },
  });

  if (error) {
    throw new Error(error.message || "Не удалось связаться с сервером авторизации");
  }
  if (data?.error) {
    const msg = String(data.error);
    if (msg.includes("not configured")) {
      throw new Error("Сервер авторизации не настроен. Добавьте TELEGRAM_BOT_TOKEN в Supabase.");
    }
    throw new Error(msg);
  }

  const { access_token, refresh_token } = data as {
    access_token: string;
    refresh_token: string;
  };

  const { error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (sessionError) throw sessionError;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) {
      console.error("[veilo] profile fetch failed", error);
      return;
    }
    setProfile(data);
  }, []);

  const signInWithTelegram = useCallback(
    async (widgetUser: TelegramWidgetUser) => {
      setAuthError(null);
      try {
        await exchangeTelegramSession(widgetUser);
        await refreshProfile();
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "Ошибка входа через Telegram");
      }
    },
    [refreshProfile],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const completeOnboarding = useCallback(async () => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return;

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", userId);

    if (error) {
      console.error("[veilo] onboarding complete failed", error);
      return;
    }
    await refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    void refreshProfile();
  }, [session?.user?.id, refreshProfile]);

  const needsOnboarding = Boolean(session && profile && !profile.onboarding_completed);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      authError,
      needsOnboarding,
      signInWithTelegram,
      signOut,
      completeOnboarding,
      refreshProfile,
    }),
    [session, profile, loading, authError, needsOnboarding, signInWithTelegram, signOut, completeOnboarding, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
