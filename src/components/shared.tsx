export function TabHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="px-4 pt-2 pb-3">
      <h1 className="font-mono text-[22px] font-extrabold leading-none" style={{ color: "var(--ink)" }}>
        {title}
      </h1>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] mt-1.5" style={{ color: "var(--ink-soft)" }}>
        {sub}
      </p>
    </div>
  );
}

export function Metric({
  label,
  value,
  big,
  accent,
}: {
  label: string;
  value: string;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span
        className={`font-mono font-extrabold leading-none tabular-nums ${big ? "text-[30px]" : "text-[16px]"}`}
        style={{ color: accent ? "var(--terracotta)" : "var(--ink)" }}
      >
        {value}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] mt-1" style={{ color: "var(--ink-soft)" }}>
        {label}
      </span>
    </div>
  );
}
