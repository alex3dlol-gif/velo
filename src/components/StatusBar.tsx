import { useTheme } from "../context/ThemeContext";
import { useApp } from "../context/AppContext";
import type { Travel } from "../context/AppContext";

export default function StatusBar({ travel }: { travel: Travel }) {
  const { isAmoled } = useTheme();

  return (
    <div
      className="flex items-center justify-between px-5 pt-3 pb-1.5 font-mono text-[11px] tracking-wide"
      style={{ color: "var(--ink-soft)" }}
    >
      <span>9:41</span>
      <span className="tracking-[0.3em] uppercase" style={{ color: "var(--ink)" }}>
        {travel === "bike" ? "⬢ на велосипеде" : "⬢ пешком"}
      </span>
      <span className="flex items-center gap-1">
        {isAmoled ? "GPS·стелс" : "GPS·5м"}
        <span className="inline-block w-6 h-2.5 rounded-[2px] border" style={{ borderColor: "var(--line-strong)" }}>
          <span className="block h-full rounded-[1px]" style={{ width: "72%", background: "var(--terracotta)" }} />
        </span>
      </span>
    </div>
  );
}
