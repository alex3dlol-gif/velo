import { useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getTelegramAuthCallbackUrl,
  setTelegramAuthHandler,
} from "../../utils/telegramAuthBridge";

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.replace(/^@/, "");

export default function TelegramLoginScreen() {
  const { signInWithTelegram, authError, loading, signingIn } = useAuth();
  const widgetRef = useRef<HTMLDivElement>(null);
  const signInRef = useRef(signInWithTelegram);
  signInRef.current = signInWithTelegram;
  const configured = Boolean(BOT_USERNAME);

  useEffect(() => {
    setTelegramAuthHandler((user) => {
      void signInRef.current(user);
    });
    return () => setTelegramAuthHandler(null);
  }, []);

  useEffect(() => {
    if (!configured || !widgetRef.current || signingIn) return;

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-auth-url", getTelegramAuthCallbackUrl());
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");

    widgetRef.current.innerHTML = "";
    widgetRef.current.appendChild(script);
  }, [configured, signingIn]);

  const busy = loading || signingIn;

  return (
    <div
      className="absolute inset-0 z-[110] flex flex-col items-center justify-center px-6"
      style={{ background: "var(--bg)" }}
    >
      <div className="text-center max-w-[300px]">
        <p className="text-[52px] leading-none mb-4">⬡</p>
        <h1 className="font-mono text-[22px] font-extrabold tracking-tight" style={{ color: "var(--ink)" }}>
          VEILO
        </h1>
        <p className="font-mono text-[11px] mt-2 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Исследуй Москву, открывай секторы и собирай прогресс по районам
        </p>
      </div>

      <div className="mt-10 w-full max-w-[300px] flex flex-col items-center gap-4">
        {busy ? (
          <p className="font-mono text-[12px] text-center" style={{ color: "var(--ink-soft)" }}>
            {signingIn ? "Входим через Telegram…" : "Проверяем сессию…"}
          </p>
        ) : configured ? (
          <>
            <p className="font-mono text-[10px] text-center uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>
              Вход через Telegram
            </p>
            <div ref={widgetRef} className="min-h-[44px] flex items-center justify-center" />
            <p className="font-mono text-[10px] text-center leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              После нажатия страница обновится — это нормально.
            </p>
          </>
        ) : (
          <div
            className="rounded-xl p-4 font-mono text-[11px] leading-relaxed text-center"
            style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px dashed var(--line)" }}
          >
            <p className="font-bold mb-2" style={{ color: "var(--ink)" }}>
              Telegram Login не настроен
            </p>
            <p>
              Добавьте <code className="text-[10px]">VITE_TELEGRAM_BOT_USERNAME</code> в переменные окружения
            </p>
          </div>
        )}

        {authError && (
          <p className="font-mono text-[11px] text-center px-2 leading-relaxed" style={{ color: "#e85d4c" }}>
            {authError}
          </p>
        )}
      </div>

      <p
        className="absolute bottom-6 font-mono text-[9px] uppercase tracking-[0.25em]"
        style={{ color: "var(--ink-soft)" }}
      >
        H3 · GPS · PWA
      </p>
    </div>
  );
}
