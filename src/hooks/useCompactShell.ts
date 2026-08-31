import { useEffect, useState } from "react";

function detectCompactShell(): boolean {
  if (typeof window === "undefined") return false;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const narrow = window.matchMedia("(max-width: 520px)").matches;
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  return standalone || (narrow && coarse);
}

export function useCompactShell(): boolean {
  const [compact, setCompact] = useState(detectCompactShell);

  useEffect(() => {
    const media = [
      window.matchMedia("(max-width: 520px)"),
      window.matchMedia("(display-mode: standalone)"),
      window.matchMedia("(display-mode: fullscreen)"),
      window.matchMedia("(hover: none) and (pointer: coarse)"),
    ];

    const update = () => setCompact(detectCompactShell());
    for (const mq of media) mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      for (const mq of media) mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return compact;
}
