import Icon from "../Icon";

type MapFabProps = {
  showGrid: boolean;
  onToggleGrid: () => void;
  onLocate: () => void;
};

export default function MapFab({ showGrid, onToggleGrid, onLocate }: MapFabProps) {
  return (
    <div
      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2.5"
      style={{ right: "max(0.75rem, var(--safe-right))" }}
    >
      <button
        onClick={onToggleGrid}
        className="map-fab-btn"
        data-active={showGrid}
        aria-label="Туман войны"
        aria-pressed={showGrid}
        title="Туман войны"
      >
        <span className="text-base leading-none" aria-hidden>
          {showGrid ? "🌫" : "🗺"}
        </span>
      </button>
      <button
        onClick={onLocate}
        className="map-fab-btn"
        aria-label="Моё местоположение"
        title="Моё местоположение"
      >
        <Icon name="locate" size={20} />
      </button>
    </div>
  );
}
