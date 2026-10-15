import { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Pin,
  ListVideo,
  Plus,
  Maximize,
  Maximize2,
  X,
  Move,
  RotateCcw,
  Subtitles,
  User,
} from 'lucide-react';
import { QueueItem, WindowPreset } from '../../types/player.types';
import { nativeService } from '../../services/native.service';

interface PlayerControlsProps {
  isVisible: boolean;
  isPlaying: boolean;
  currentItem: QueueItem | null;
  hasPrevious: boolean;
  hasNext: boolean;
  pendingCount: number;
  alwaysOnTop: boolean;
  showCaptions: boolean;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  preset: WindowPreset;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onToggleMute: () => void;
  onToggleCaptions: () => void;
  onVolumeChange: (val: number) => void;
  onToggleAlwaysOnTop: () => void;
  onToggleQueue: () => void;
  onOpenQuickAdd: () => void;
  onChangePreset: (preset: WindowPreset) => void;
  onResetVideo: () => void;
  onToggleFullscreen: () => void;
  onOpenAuthModal?: () => void;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isVisible,
  isPlaying,
  currentItem,
  hasPrevious,
  hasNext,
  pendingCount,
  alwaysOnTop,
  showCaptions,
  volume,
  isMuted,
  currentTime,
  duration,
  preset,
  onPlayPause,
  onPrevious,
  onNext,
  onSeek,
  onToggleMute,
  onToggleCaptions,
  onVolumeChange,
  onToggleAlwaysOnTop,
  onToggleQueue,
  onOpenQuickAdd,
  onChangePreset,
  onResetVideo,
  onToggleFullscreen,
  onOpenAuthModal,
  onClose,
}) => {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  useEffect(() => {
    if (!isSeeking) {
      setSeekValue(currentTime);
    }
  }, [currentTime, isSeeking]);

  const cyclePreset = () => {
    const presets: WindowPreset[] = ['small', 'medium', 'large', 'xlarge'];
    const currentIndex = presets.indexOf(preset);
    const nextPreset = presets[(currentIndex + 1) % presets.length];
    onChangePreset(nextPreset);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSeeking(true);
    setSeekValue(parseFloat(e.target.value));
  };

  const handleSeekCommit = () => {
    setIsSeeking(false);
    onSeek(seekValue);
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (seekValue / duration) * 100)) : 0;

  return (
    <div
      className={`player-controls-overlay ${isVisible ? 'visible' : 'hidden'}`}
    >
      {/* Barra Superior de Arraste e Ações Rápidas */}
      <div
        className="controls-header"
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.button === 0 && !(e.target as HTMLElement).closest('button, input')) {
            nativeService.startDragging();
          }
        }}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest('button, input')) {
            onToggleFullscreen();
          }
        }}
      >
        <div
          className="title-section"
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.button === 0) {
              nativeService.startDragging();
            }
          }}
          onDoubleClick={onToggleFullscreen}
        >
          <Move size={14} className="drag-icon" style={{ pointerEvents: 'none' }} />
          <span className="video-title-truncate" title={currentItem?.title} style={{ pointerEvents: 'none' }}>
            {currentItem?.title || 'Mini Player'}
          </span>
        </div>

        <div className="header-actions" onMouseDown={(e) => e.stopPropagation()}>
          {/* Sessão / Conta / Cookies */}
          {onOpenAuthModal && (
            <button
              className="icon-btn auth-btn"
              title="Aproveitar login do Firefox / Chrome ou Conectar Conta Google"
              onClick={onOpenAuthModal}
            >
              <User size={14} />
            </button>
          )}

          {/* Adicionar rápido */}
          <button
            className="icon-btn"
            title="Adicionar link à fila (Ctrl+Shift+A)"
            onClick={onOpenQuickAdd}
          >
            <Plus size={15} />
          </button>

          {/* Fila / Playlist */}
          <button
            className="icon-btn queue-btn"
            title="Ver fila de reprodução"
            onClick={onToggleQueue}
          >
            <ListVideo size={15} />
            {pendingCount > 0 && (
              <span className="queue-badge">{pendingCount}</span>
            )}
          </button>

          {/* Alternar Tamanho */}
          <button
            className="icon-btn"
            title={`Tamanho atual: ${preset.toUpperCase()} (Clique para alternar)`}
            onClick={cyclePreset}
          >
            <Maximize2 size={14} />
          </button>

          {/* Legendas / Closed Captions */}
          <button
            className={`icon-btn ${showCaptions ? 'active-cc' : ''}`}
            title={showCaptions ? 'Desativar legendas' : 'Ativar legendas'}
            onClick={onToggleCaptions}
          >
            <Subtitles size={15} />
          </button>

          {/* Tela Cheia / Fullscreen */}
          <button
            className="icon-btn"
            title="Alternar Tela Inteira / Fullscreen"
            onClick={onToggleFullscreen}
          >
            <Maximize size={14} />
          </button>

          {/* Always on top */}
          <button
            className={`icon-btn ${alwaysOnTop ? 'active-pin' : ''}`}
            title={alwaysOnTop ? 'Desafixar (Ctrl+Shift+T)' : 'Fixar sempre no topo (Ctrl+Shift+T)'}
            onClick={onToggleAlwaysOnTop}
          >
            <Pin size={15} />
          </button>

          {/* Fechar */}
          <button
            className="icon-btn close-btn"
            title="Fechar player"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Centro: Botões de Navegação Principal */}
      <div className="controls-center" onMouseDown={(e) => e.stopPropagation()}>
        <button
          className="nav-btn mini"
          title="Reiniciar vídeo do início"
          onClick={onResetVideo}
        >
          <RotateCcw size={14} />
        </button>

        <button
          className="nav-btn"
          disabled={!hasPrevious}
          title="Vídeo anterior (Ctrl+Shift+Left)"
          onClick={onPrevious}
        >
          <SkipBack size={18} />
        </button>

        <button
          className="play-pause-btn"
          title={isPlaying ? 'Pausar (Space)' : 'Reproduzir (Space)'}
          onClick={onPlayPause}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} className="play-icon-offset" />}
        </button>

        <button
          className="nav-btn"
          disabled={!hasNext}
          title="Próximo vídeo (Ctrl+Shift+Right)"
          onClick={onNext}
        >
          <SkipForward size={18} />
        </button>
      </div>

      {/* Barra Inferior: Progresso e Volume */}
      <div className="controls-footer" onMouseDown={(e) => e.stopPropagation()}>
        {/* Barra de Progresso Estilo Onda Material Design */}
        <div className="progress-bar-container">
          <div className="wavy-track-bg" />
          <div
            className={`wavy-track-fill ${isPlaying ? 'playing' : 'paused'}`}
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="wavy-thumb"
            style={{ left: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.5}
            value={seekValue}
            onChange={handleSeekChange}
            onMouseUp={handleSeekCommit}
            onTouchEnd={handleSeekCommit}
            className="timeline-slider-overlay"
            title={`${formatTime(seekValue)} / ${formatTime(duration)}`}
          />
        </div>

        <div className="footer-bottom-row">
          <span className="time-display">
            {formatTime(seekValue)} / {formatTime(duration)}
          </span>

          <div className="volume-container">
            <button
              className="icon-btn volume-btn"
              title={isMuted ? 'Desativar mudo' : 'Mudo'}
              onClick={onToggleMute}
            >
              {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
              className="volume-slider"
              title={`Volume: ${isMuted ? 0 : volume}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
