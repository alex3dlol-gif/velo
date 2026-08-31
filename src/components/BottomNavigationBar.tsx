import Icon from "./Icon";
import { useApp, type Tab } from "../context/AppContext";

const ITEMS: { id: Tab; label: string }[] = [
  { id: "map", label: "Карта" },
  { id: "log", label: "Журнал" },
  { id: "leaders", label: "Лидеры" },
  { id: "quests", label: "Задачи" },
  { id: "settings", label: "Настройки" },
];

export default function BottomNavigationBar() {
  const { activeTab, setActiveTab } = useApp();

  return (
    <nav
      className="relative z-20 grid grid-cols-5 shrink-0 px-2 pt-2 pb-3"
      style={{ background: "var(--surface)", borderTop: "1px solid var(--line)" }}
    >
      {ITEMS.map((it) => {
        const active = activeTab === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setActiveTab(it.id)}
            className="flex flex-col items-center gap-1 py-1 transition"
            style={{ color: active ? "var(--terracotta)" : "var(--ink-soft)" }}
          >
            <Icon name={it.id} size={21} />
            <span
              className="font-mono text-[9px] uppercase tracking-wider"
              style={{ fontWeight: active ? 700 : 400 }}
            >
              {it.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
