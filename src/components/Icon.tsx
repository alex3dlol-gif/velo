import type { ReactElement } from "react";
import type { Tab } from "../context/AppContext";

type IconName = Tab | "photo" | "pause" | "stop" | "check" | "chevron" | "bolt" | "layers" | "locate";

export default function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactElement> = {
    map: (
      <>
        <path d="M9 3 4 5v16l5-2 6 2 5-2V3l-5 2-6-2Z" />
        <path d="M9 3v16M15 5v16" />
      </>
    ),
    log: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M4 15l4-4 3 3 5-5 4 4" />
        <circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" />
      </>
    ),
    leaders: <path d="M6 20V10M12 20V4M18 20v-7" />,
    quests: (
      <>
        <path d="M9 11l2 2 4-4" />
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
      </>
    ),
    photo: (
      <>
        <rect x="3" y="6" width="18" height="14" rx="2" />
        <path d="M8 6l1.5-2h5L16 6" />
        <circle cx="12" cy="13" r="3.5" />
      </>
    ),
    pause: (
      <>
        <rect x="7" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none" />
        <rect x="13.6" y="5" width="3.4" height="14" rx="1" fill="currentColor" stroke="none" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
    check: <path d="M5 12l4 4 10-10" />,
    chevron: <path d="M9 6l6 6-6 6" />,
    bolt: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
    layers: (
      <>
        <path d="M12 2 2 7l10 5 10-5-10-5Z" />
        <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
      </>
    ),
    locate: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
