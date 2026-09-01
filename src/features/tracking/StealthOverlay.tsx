import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useStealth } from "./StealthProvider";

type StealthOverlayProps = {
  speedKmh: number;
  sessionSectors: number;
  rideTimer?: string;
};

function formatClock(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function StealthOverlay({ speedKmh, sessionSectors, rideTimer }: StealthOverlayProps) {
  const { isStealthActive, registerActivity } = useStealth();
  const [time, setTime] = useState(() => formatClock(new Date()));

  useEffect(() => {
    if (!isStealthActive) return;
    const id = setInterval(() => setTime(formatClock(new Date())), 30_000);
    setTime(formatClock(new Date()));
    return () => clearInterval(id);
  }, [isStealthActive]);

  return (
    <AnimatePresence>
      {isStealthActive && (
        <motion.div
          key="stealth"
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center select-none"
          style={{ background: "#000000" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          onPointerDown={registerActivity}
          onTouchStart={registerActivity}
        >
          <p
            className="font-mono text-[10px] uppercase tracking-[0.32em] text-center px-6"
            style={{ color: "#4A4A4A" }}
          >
            РЕЖИМ ЗАПИСИ · ТАПАЙТЕ ДЛЯ ПРОБУЖДЕНИЯ
          </p>
          <p className="font-mono text-[48px] font-extrabold mt-8 tabular-nums" style={{ color: "#4A4A4A" }}>
            {time}
          </p>
          <div className="mt-10 flex gap-10 font-mono text-[13px] uppercase tracking-widest" style={{ color: "#4A4A4A" }}>
            {rideTimer && <span>{rideTimer}</span>}
            <span>{speedKmh.toFixed(1)} км/ч</span>
            <span>+{sessionSectors} сект.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
