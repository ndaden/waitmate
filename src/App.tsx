import { useWaitMate } from './hooks/useWaitMate';
import { CompanionAvatar } from './components/CompanionAvatar';
import { MiniGame } from './components/MiniGame';
import { SuccessBanner } from './components/SuccessBanner';
import { WelcomeCard } from './components/WelcomeCard';
import './App.css';

export function App() {
  const {
    mood,
    stats,
    startPayload,
    stopPayload,
    keepOpen,
    toggleKeepOpen,
    showOnboarding,
    dismissOnboarding,
    triggerManualStart,
    dismissActiveMode,
  } = useWaitMate();

  return (
    <main className="w-full h-full flex flex-col justify-end items-end p-2 relative overflow-hidden select-none">
      {/* Onboarding Welcome Card (only displayed once on first launch) */}
      {showOnboarding && (
        <div className="mb-2 w-full transition-all duration-300 ease-out">
          <WelcomeCard onDismiss={dismissOnboarding} />
        </div>
      )}

      {/* Game Panel or Success Banner */}
      {!showOnboarding && mood === 'active' && (
        <div className="mb-2 w-full transition-all duration-300 ease-out">
          <MiniGame
            stats={stats}
            startPayload={startPayload}
            keepOpen={keepOpen}
            onToggleKeepOpen={toggleKeepOpen}
            onClose={dismissActiveMode}
          />
        </div>
      )}

      {!showOnboarding && mood === 'success' && (
        <div className="mb-2 w-full transition-all duration-300 ease-out">
          <SuccessBanner
            stats={stats}
            stopPayload={stopPayload}
            onClose={dismissActiveMode}
          />
        </div>
      )}

      {/* Companion Floating Avatar */}
      <div className="flex items-center justify-end w-full">
        <CompanionAvatar
          mood={showOnboarding ? 'active' : mood}
          onClick={() => {
            if (showOnboarding) {
              dismissOnboarding();
            } else if (mood === 'idle') {
              triggerManualStart();
            }
          }}
          onTestClick={triggerManualStart}
        />
      </div>
    </main>
  );
}

export default App;
