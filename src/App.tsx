import { useState } from 'react';
import { usePlayerQueue } from './hooks/usePlayerQueue';
import { MiniPlayer } from './components/player/MiniPlayer';
import { YoutubeUrlForm } from './components/input/YoutubeUrlForm';
import { QuickAddWindow } from './components/quick-add/QuickAddWindow';
import { AuthWindow } from './components/auth/AuthWindow';
import { Toast } from './components/ui/Toast';
import { nativeService } from './services/native.service';

export function App() {
  const windowParam = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('window')
    : null;

  if (windowParam === 'quick-add') {
    return <QuickAddWindow />;
  }

  if (windowParam === 'auth') {
    return <AuthWindow />;
  }

  const queueController = usePlayerQueue();
  const { currentItem, addToQueue, toastMessage, hideToast } = queueController;
  const [manualFormView, setManualFormView] = useState(false);

  const isPlayerActive = currentItem !== null && !manualFormView;

  const handleStartPlay = async (url: string) => {
    const res = await addToQueue(url, true);
    if (res.success) {
      setManualFormView(false);
    }
    return res;
  };

  const handleCloseApp = () => {
    nativeService.closeApp();
  };

  return (
    <div className="app-container">
      <Toast message={toastMessage} onDismiss={hideToast} />

      {isPlayerActive ? (
        <MiniPlayer
          queueController={queueController}
          onResetToForm={() => setManualFormView(true)}
        />
      ) : (
        <YoutubeUrlForm
          onSubmit={handleStartPlay}
          onClose={handleCloseApp}
        />
      )}
    </div>
  );
}

export default App;
