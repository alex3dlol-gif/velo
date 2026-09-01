import { AnimatePresence, motion } from "framer-motion";
import { AppProvider, useApp } from "./context/AppContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { FogOfWarProvider } from "./context/FogOfWarContext";
import { GeolocationProvider } from "./context/GeolocationContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import BottomNavigationBar from "./components/BottomNavigationBar";
import ExploreMode from "./components/ExploreMode";
import StatusBar from "./components/StatusBar";
import TelegramLoginScreen from "./components/auth/TelegramLoginScreen";
import OnboardingFlow from "./components/onboarding/OnboardingFlow";
import MapTab from "./components/tabs/MapTab";
import LogTab from "./components/tabs/LogTab";
import LeadersTab from "./components/tabs/LeadersTab";
import QuestsTab from "./components/tabs/QuestsTab";
import SettingsTab from "./components/tabs/SettingsTab";
import { useCompactShell } from "./hooks/useCompactShell";
import { useGeolocation } from "./hooks/useGeolocation";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <VeiloApp />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function VeiloApp() {
  const { session } = useAuth();
  return (
    <FogOfWarProvider>
      <GeolocationProvider enabled={Boolean(session)}>
        <VeiloShell />
      </GeolocationProvider>
    </FogOfWarProvider>
  );
}

function VeiloShell() {
  const { isAmoled } = useTheme();
  const { travel, isExploring, activeTab } = useApp();
  const { session, loading, needsOnboarding } = useAuth();
  const compact = useCompactShell();
  const { position } = useGeolocation(Boolean(session));

  return (
    <div
      className={compact ? "h-[100dvh] w-full overflow-hidden" : "size-full flex items-center justify-center p-4"}
      style={{ background: compact ? "var(--bg)" : "#14100c" }}
    >
      <div
        className={`app-theme${isAmoled ? " amoled" : ""} ${compact ? "app-shell-compact" : "app-shell-mockup"} relative overflow-hidden flex flex-col`}
        style={
          compact
            ? {
                width: "100%",
                height: "100%",
                background: "var(--bg)",
                color: "var(--ink)",
              }
            : {
                width: "min(410px, 96vw)",
                aspectRatio: "9 / 16",
                height: "min(96vh, calc(96vw * 16 / 9))",
                maxHeight: "900px",
                background: "var(--bg)",
                color: "var(--ink)",
                borderRadius: 34,
                border: "1px solid var(--line)",
                boxShadow: "0 40px 90px -30px rgba(0,0,0,.7), 0 0 0 8px #0b0906",
              }
        }
      >
        {loading ? (
          <div className="flex-1 flex items-center justify-center font-mono text-[12px]" style={{ color: "var(--ink-soft)" }}>
            загрузка…
          </div>
        ) : !session ? (
          <TelegramLoginScreen />
        ) : (
          <>
            <StatusBar travel={travel} gpsAccuracyM={position?.accuracy} />

            <AnimatePresence mode="wait">
              {isExploring ? (
                <motion.div
                  key="explore"
                  className="flex-1 min-h-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <ExploreMode />
                </motion.div>
              ) : (
                <motion.div
                  key="main"
                  className="flex-1 min-h-0 flex flex-col"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex-1 min-h-0 relative">
                    {activeTab === "map" && <MapTab />}
                    {activeTab === "log" && <LogTab />}
                    {activeTab === "leaders" && <LeadersTab />}
                    {activeTab === "quests" && <QuestsTab />}
                    {activeTab === "settings" && <SettingsTab />}
                  </div>
                  <BottomNavigationBar />
                </motion.div>
              )}
            </AnimatePresence>

            {needsOnboarding && <OnboardingFlow />}
          </>
        )}
      </div>
    </div>
  );
}
