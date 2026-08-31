import { useEffect, useRef } from "react";
import { useAuth, type TelegramWidgetUser } from "../../context/AuthContext";

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME?.replace(/^@/, "");

export default function TelegramLoginScreen() {
  const { signInWithTelegram, authError, loading } = useAuth();
  const widgetRef = useRef<HTMLDivElement>(null);
  const configured = Boolean(BOT_USERNAME);

  useEffect(() => {
    if (!configured || !widgetRef.current) return;

    window.onTelegramAuth = (user) => {
      void signInWithTelegram(user);
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");

    widgetRef.current.innerHTML = "";
    widgetRef.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [configured, signInWithTelegram]);

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
        {loading ? (
          <p className="font-mono text-[12px]" style={{ color: "var(--ink-soft)" }}>
            Проверяем сессию…
          </p>
        ) : configured ? (
          <>
            <p className="font-mono text-[10px] text-center uppercase tracking-widest" style={{ color: "var(--ink-soft)" }}>
              Вход через Telegram
            </p>
            <div ref={widgetRef} className="min-h-[44px] flex items-center justify-center" />
            <p className="font-mono text-[10px] text-center leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Нажмите кнопку — откроется окно Telegram для подтверждения.
            </p>
            {window.location.hostname === "localhost" && (
              <p
                className="font-mono text-[9px] text-center leading-relaxed px-2 rounded-lg py-2"
                style={{ background: "var(--surface-2)", color: "#e85d4c", border: "1px solid var(--line)" }}
              >
                localhost не работает с Telegram Login. Откройте{" "}
                <strong>veilo.localtest.me:{window.location.port || "8443"}</strong> и привяжите домен{" "}
                <strong>localtest.me</strong> в @BotFather → /setdomain
              </p>
            )}
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
              Добавьте в <code className="text-[10px]">.env.local</code>:
              <br />
              <code className="text-[10px]">VITE_TELEGRAM_BOT_USERNAME</code>
            </p>
          </div>
        )}

        {authError && (
          <p className="font-mono text-[11px] text-center px-2" style={{ color: "#e85d4c" }}>
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
