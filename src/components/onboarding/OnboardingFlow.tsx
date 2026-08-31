import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ONBOARDING_STEPS } from "./onboardingSteps";

export default function OnboardingFlow() {
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState(0);
  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  const finish = () => void completeOnboarding();

  return (
    <div
      className="absolute inset-0 z-[120] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <motion.div
        key={current.id}
        className="w-full rounded-t-2xl p-5 pb-7"
        style={{
          maxWidth: 410,
          background: "var(--surface)",
          borderTop: "1px solid var(--line)",
        }}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <div className="flex items-center gap-1.5 mb-5">
          {ONBOARDING_STEPS.map((s, i) => (
            <span
              key={s.id}
              className="h-1 rounded-full flex-1 transition-all"
              style={{
                background: i <= step ? "var(--terracotta)" : "var(--line)",
                opacity: i <= step ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            <p className="text-[42px] leading-none mb-3">{current.emoji}</p>
            <h2 className="font-mono text-[18px] font-extrabold leading-snug" style={{ color: "var(--ink)" }}>
              {current.title}
            </h2>
            <p className="font-mono text-[12px] leading-relaxed mt-3" style={{ color: "var(--ink-soft)" }}>
              {current.body}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-2.5 mt-7">
          {!isLast && (
            <button
              onClick={finish}
              className="flex-1 rounded-xl py-3 font-mono text-[11px] font-bold uppercase tracking-widest"
              style={{ background: "var(--surface-2)", color: "var(--ink-soft)", border: "1px solid var(--line)" }}
            >
              пропустить
            </button>
          )}
          <button
            onClick={isLast ? finish : () => setStep((s) => s + 1)}
            className="flex-[2] rounded-xl py-3 font-mono text-[11px] font-bold uppercase tracking-widest"
            style={{ background: "var(--terracotta)", color: "#fff" }}
          >
            {isLast ? "начать исследование" : "далее"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
