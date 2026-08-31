import Icon from "../Icon";

type MapFabProps = {
  showGrid: boolean;
  onToggleGrid: () => void;
  onLocate: () => void;
};

export default function MapFab({ showGrid, onToggleGrid, onLocate }: MapFabProps) {
  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
      <button
        onClick={onToggleGrid}
        className="w-11 h-11 rounded-xl flex items-center justify-center transition active:scale-95"
        style={{
          background: showGrid ? "var(--terracotta)" : "var(--surface)",
          color: showGrid ? "#fff" : "var(--ink)",
          border: `1.5px solid ${showGrid ? "var(--terracotta)" : "var(--line-strong)"}`,
          boxShadow: "0 4px 14px -4px rgba(0,0,0,.35)",
        }}
        aria-label="Слои карты"
        aria-pressed={showGrid}
        title="Сетка H3"
      >
        <Icon name="layers" size={20} />
      </button>
      <button
        onClick={onLocate}
        className="w-11 h-11 rounded-xl flex items-center justify-center transition active:scale-95"
        style={{
          background: "var(--surface)",
          color: "var(--terracotta)",
          border: "1.5px solid var(--line-strong)",
          boxShadow: "0 4px 14px -4px rgba(0,0,0,.35)",
        }}
        aria-label="Моё местоположение"
        title="Моё местоположение"
      >
        <Icon name="locate" size={20} />
      </button>
    </div>
  );
}
