import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useApp, type Travel } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import Icon from "../Icon";
import H3InfoBlock from "../H3InfoBlock";
import { TabHeader } from "../shared";
import {
  isHapticsEnabled,
  isHapticsSupported,
  setHapticsEnabled,
} from "../../utils/haptics";

export default function SettingsTab() {
  const { isAmoled, toggleAmoled } = useTheme();
  const { travel, setTravel } = useApp();
  const { profile, signOut } = useAuth();
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled);
  const hapticsAvailable = isHapticsSupported();

  return (
    <div className="h-full flex flex-col">
      <TabHeader title="Настройки" sub="карта · движение · приватность" />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-area px-4 pb-4 space-y-4">
        {profile && (
          <div className="rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="" className="w-11 h-11 rounded-full object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-full flex items-center justify-center font-mono text-[16px] font-bold" style={{ background: "var(--bg-2)", color: "var(--terracotta)" }}>
                {(profile.username ?? "?")[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[13px] font-bold truncate" style={{ color: "var(--ink)" }}>
                {profile.username ?? "Игрок"}
              </p>
              <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                {profile.total_sectors_opened} секторов открыто
              </p>
            </div>
            <button
              onClick={() => void signOut()}
              className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-lg"
              style={{ color: "var(--ink-soft)", border: "1px solid var(--line)" }}
            >
              выйти
            </button>
          </div>
        )}

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                AMOLED Stealth
              </p>
              <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                чистый чёрный фон #000000 · экономия батареи
              </p>
            </div>
            <button
              onClick={toggleAmoled}
              className="w-14 h-8 rounded-full relative transition"
              style={{ background: isAmoled ? "var(--terracotta)" : "var(--bg-2)" }}
              aria-pressed={isAmoled}
            >
              <span
                className="absolute top-1 w-6 h-6 rounded-full transition-all"
                style={{ left: isAmoled ? "30px" : "4px", background: isAmoled ? "#fff" : "var(--surface)" }}
              />
            </button>
          </div>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[13px] font-bold" style={{ color: "var(--ink)" }}>
                Тактильный отклик
              </p>
              <p className="font-mono text-[10px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                {hapticsAvailable
                  ? "вибрация при новых секторах и превышении скорости"
                  : "не поддерживается на этом устройстве"}
              </p>
            </div>
            <button
              onClick={() => {
                const next = !hapticsOn;
                setHapticsOn(next);
                setHapticsEnabled(next);
              }}
              disabled={!hapticsAvailable}
              className="w-14 h-8 rounded-full relative transition disabled:opacity-40"
              style={{ background: hapticsOn && hapticsAvailable ? "var(--terracotta)" : "var(--bg-2)" }}
              aria-pressed={hapticsOn}
            >
              <span
                className="absolute top-1 w-6 h-6 rounded-full transition-all"
                style={{
                  left: hapticsOn && hapticsAvailable ? "30px" : "4px",
                  background: hapticsOn ? "#fff" : "var(--surface)",
                }}
              />
            </button>
          </div>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div className="grid grid-cols-2 gap-2">
            {(["bike", "walk"] as Travel[]).map((m) => (
              <button
                key={m}
                onClick={() => setTravel(m)}
                className="rounded-xl py-3 font-mono text-[13px] font-bold uppercase tracking-wider transition active:scale-[.98]"
                style={{
                  background: travel === m ? "var(--terracotta)" : "var(--surface-2)",
                  color: travel === m ? "#fff" : "var(--ink)",
                  border: `1.5px solid ${travel === m ? "var(--terracotta)" : "var(--line)"}`,
                }}
              >
                {m === "bike" ? "🚲 велосипед" : "🥾 пешком"}
              </button>
            ))}
          </div>
          <p className="font-mono text-[10px] mt-2.5" style={{ color: "var(--ink-soft)" }}>
            влияет на радиус захвата секторов и расчёт темпа
          </p>
        </div>

        <H3InfoBlock />

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          {["Точность GPS", "Приватные зоны", "Автопауза на остановках", "Единицы: метрические"].map((r, i) => (
            <div
              key={r}
              className="flex items-center justify-between px-4 py-3.5"
              style={{ borderTop: i ? "1px solid var(--line)" : "none" }}
            >
              <span className="font-mono text-[12px]" style={{ color: "var(--ink)" }}>
                {r}
              </span>
              <span style={{ color: "var(--ink-soft)" }}>
                <Icon name="chevron" size={16} />
              </span>
            </div>
          ))}
        </div>

        <p className="text-center font-mono text-[10px] pt-1" style={{ color: "var(--ink-soft)" }}>
          VEILO · v0.9.4 · H3 r9 · Москва
        </p>
      </div>
    </div>
  );
}
