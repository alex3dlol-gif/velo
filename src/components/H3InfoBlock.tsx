import { H3_INFO_TEXT, H3_INFO_TITLE } from "../constants/units";

export default function H3InfoBlock() {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
      <p className="font-mono text-[13px] font-bold" style={{ color: "var(--ink)" }}>
        {H3_INFO_TITLE}
      </p>
      <p className="font-mono text-[11px] leading-relaxed mt-2" style={{ color: "var(--ink-soft)" }}>
        {H3_INFO_TEXT}
      </p>
      <p className="font-mono text-[10px] mt-3 uppercase tracking-widest" style={{ color: "var(--terracotta)" }}>
        1 сектор = 1 очко разведки
      </p>
    </div>
  );
}
