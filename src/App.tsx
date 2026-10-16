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

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    direction: 'North' | 'South' | 'East' | 'West' | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest'
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    nativeService.startResizeDragging(direction);
  };

  return (
    <div className={`app-container ${isPlayerActive ? 'player-mode' : 'form-mode'}`}>
      {/* Zonas de redimensionamento proporcional nas bordas e cantos */}
      <div className="window-resize-handle n" onMouseDown={(e) => handleResizeMouseDown(e, 'North')} />
      <div className="window-resize-handle s" onMouseDown={(e) => handleResizeMouseDown(e, 'South')} />
      <div className="window-resize-handle e" onMouseDown={(e) => handleResizeMouseDown(e, 'East')} />
      <div className="window-resize-handle w" onMouseDown={(e) => handleResizeMouseDown(e, 'West')} />
      <div className="window-resize-handle nw" onMouseDown={(e) => handleResizeMouseDown(e, 'NorthWest')} />
      <div className="window-resize-handle ne" onMouseDown={(e) => handleResizeMouseDown(e, 'NorthEast')} />
      <div className="window-resize-handle sw" onMouseDown={(e) => handleResizeMouseDown(e, 'SouthWest')} />
      <div className="window-resize-handle se" onMouseDown={(e) => handleResizeMouseDown(e, 'SouthEast')} />

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
