import { useWaitMate } from './hooks/useWaitMate';
import { CompanionAvatar } from './components/CompanionAvatar';
import { MiniGame } from './components/MiniGame';
import { SuccessBanner } from './components/SuccessBanner';
import './App.css';

export function App() {
  const {
    mood,
    stats,
    startPayload,
    stopPayload,
    triggerManualStart,
    dismissActiveMode,
  } = useWaitMate();

  return (
    <main className="w-full h-full flex flex-col justify-end items-end p-2 relative overflow-hidden select-none">
      {/* Panneau de Jeu ou Bannière de Fin */}
      {mood === 'active' && (
        <div className="mb-2 w-full transition-all duration-300 ease-out">
          <MiniGame
            stats={stats}
            startPayload={startPayload}
            onClose={dismissActiveMode}
          />
        </div>
      )}

      {mood === 'success' && (
        <div className="mb-2 w-full transition-all duration-300 ease-out">
          <SuccessBanner
            stats={stats}
            stopPayload={stopPayload}
            onClose={dismissActiveMode}
          />
        </div>
      )}

      {/* Avatar Flottant du Compagnon */}
      <div className="flex items-center justify-end w-full">
        <CompanionAvatar
          mood={mood}
          onClick={() => {
            if (mood === 'idle') {
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
