import { useTheme } from "../context/ThemeContext";
import { useLiveClock } from "../hooks/useLiveClock";
import { useBatteryLevel } from "../hooks/useBatteryLevel";
import type { Travel } from "../context/AppContext";

type StatusBarProps = {
  travel: Travel;
  gpsAccuracyM?: number | null;
};

export default function StatusBar({ travel, gpsAccuracyM }: StatusBarProps) {
  const { isAmoled } = useTheme();
  const time = useLiveClock();
  const battery = useBatteryLevel();

  const gpsLabel =
    gpsAccuracyM != null && Number.isFinite(gpsAccuracyM)
      ? `GPS·${Math.round(gpsAccuracyM)}м`
      : isAmoled
        ? "GPS·стелс"
        : "GPS";

  return (
    <header
      className="status-bar shrink-0 flex items-center justify-between font-mono text-[11px] tracking-wide z-30"
      style={{
        color: "var(--ink-soft)",
        paddingTop: "var(--safe-top)",
        paddingBottom: "0.35rem",
        paddingLeft: "var(--safe-left)",
        paddingRight: "var(--safe-right)",
        background: "var(--bg)",
      }}
    >
      <span className="tabular-nums font-semibold" style={{ color: "var(--ink)" }}>
        {time}
      </span>

      <span className="tracking-[0.22em] uppercase text-[10px] font-bold" style={{ color: "var(--ink)" }}>
        {travel === "bike" ? "на велосипеде" : "пешком"}
      </span>

      <span className="flex items-center gap-1.5 tabular-nums">
        <span>{gpsLabel}</span>
        {battery.supported && battery.level != null ? (
          <BatteryIcon level={battery.level} charging={battery.charging} />
        ) : (
          <SignalIcon />
        )}
      </span>
    </header>
  );
}

function BatteryIcon({ level, charging }: { level: number; charging: boolean }) {
  const fill = Math.max(8, Math.min(100, level));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Заряд ${level}%`}>
      <span
        className="inline-block w-6 h-2.5 rounded-[2px] border relative overflow-hidden"
        style={{ borderColor: "var(--line-strong)" }}
      >
        <span
          className="block h-full rounded-[1px] transition-[width] duration-500"
          style={{ width: `${fill}%`, background: charging ? "var(--amber)" : "var(--terracotta)" }}
        />
      </span>
      {charging && <span className="text-[9px]">⚡</span>}
      <span className="text-[9px] w-6 text-right">{level}</span>
    </span>
  );
}

function SignalIcon() {
  return (
    <span className="inline-flex items-end gap-[2px] h-2.5" aria-hidden>
      <span className="w-[2px] h-[3px] rounded-[1px]" style={{ background: "var(--ink-soft)" }} />
      <span className="w-[2px] h-[5px] rounded-[1px]" style={{ background: "var(--ink-soft)" }} />
      <span className="w-[2px] h-[7px] rounded-[1px]" style={{ background: "var(--terracotta)" }} />
      <span className="w-[2px] h-[9px] rounded-[1px]" style={{ background: "var(--terracotta)" }} />
    </span>
  );
}
