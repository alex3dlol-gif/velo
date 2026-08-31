import { useState } from "react";
import { SECTOR_LABEL } from "../constants/units";
import H3InfoBlock from "./H3InfoBlock";

type SectorMetricProps = {
  value: string;
  big?: boolean;
  prefix?: string;
};

export default function SectorMetric({ value, big, prefix }: SectorMetricProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowInfo(true)}
        className="flex flex-col text-left transition active:opacity-80"
        aria-label={`${value} ${SECTOR_LABEL}. Подробнее о сетке H3`}
      >
        <span
          className={`font-mono font-extrabold leading-none tabular-nums ${big ? "text-[30px]" : "text-[16px]"}`}
          style={{ color: "var(--terracotta)" }}
        >
          {prefix}
          {value}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] mt-1 underline decoration-dotted underline-offset-2" style={{ color: "var(--ink-soft)" }}>
          {SECTOR_LABEL}
        </span>
      </button>

      {showInfo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowInfo(false)}
        >
          <div
            className="w-full rounded-t-2xl p-4 pb-6"
            style={{
              maxWidth: 410,
              background: "var(--surface)",
              borderTop: "1px solid var(--line)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <H3InfoBlock />
            <button
              onClick={() => setShowInfo(false)}
              className="mt-4 w-full rounded-xl py-3 font-mono text-[12px] font-bold uppercase tracking-widest"
              style={{ background: "var(--terracotta)", color: "#fff" }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
}
