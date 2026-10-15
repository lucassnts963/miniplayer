import React, { useState, useRef, useEffect, useCallback } from 'react';
import { YoutubeEmbed, YoutubeEmbedRef } from './YoutubeEmbed';
import { PlayerControls } from './PlayerControls';
import { QueueDrawer } from '../queue/QueueDrawer';
import { Toast } from '../ui/Toast';
import { useMouseVisibility } from '../../hooks/useMouseVisibility';
import { usePlayerQueue } from '../../hooks/usePlayerQueue';
import { nativeService } from '../../services/native.service';
import { AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface MiniPlayerProps {
  queueController: ReturnType<typeof usePlayerQueue>;
  onResetToForm: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ queueController, onResetToForm }) => {
  const {
    queue,
    currentIndex,
    currentItem,
    settings,
    toastMessage,
    showToast,
    hideToast,
    addToQueue,
    nextVideo,
    previousVideo,
    playItemAt,
    removeItem,
    clearQueue,
    reorderQueue,
    handleVideoError,
    toggleAlwaysOnTop,
    changePreset,
    toggleCaptions,
    getSavedPosition,
    savePlaybackPosition,
    clearSavedPosition,
    playlists,
    activePlaylistId,
    createPlaylist,
    switchPlaylist,
    renamePlaylist,
    deletePlaylist,
    updateSettings,
  } = queueController;

  const playerRef = useRef<YoutubeEmbedRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [embedError, setEmbedError] = useState<{ code: number; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Posição salva para o vídeo atual
  const savedStartTime = currentItem ? getSavedPosition(currentItem.id) : 0;

  const { isVisible: areControlsVisible, onMouseMove, onMouseEnter, onMouseLeave, lockVisibility } =
    useMouseVisibility({ timeoutMs: 1800 });

  // Sincronizar bloqueio dos controles e ref quando a fila estiver aberta
  const isQueueOpenRef = useRef(isQueueOpen);
  useEffect(() => {
    isQueueOpenRef.current = isQueueOpen;
    lockVisibility(isQueueOpen);
  }, [isQueueOpen, lockVisibility]);

  // Atualizar currentTime e duration periodicamente e salvar posição onde parou
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current) {
        const time = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        if (time !== undefined && !isNaN(time)) {
          setCurrentTime(time);
          if (currentItem && time > 2) {
            savePlaybackPosition(currentItem.id, time);
          }
        }
        if (dur !== undefined && !isNaN(dur)) setDuration(dur);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [currentItem, savePlaybackPosition]);

  // Atalhos de teclado locais (Space para Play/Pause, Esc para fechar fila)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se o foco estiver dentro de um campo de texto ou textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (playerRef.current) {
          playerRef.current.togglePlay();
        }
      } else if (e.code === 'Escape') {
        if (isQueueOpen) {
          e.preventDefault();
          setIsQueueOpen(false);
        } else {
          nativeService.toggleFullscreen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQueueOpen]);

  // Controles do player
  const handlePlayPause = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.togglePlay();
    }
  }, []);

  const handleSeek = useCallback((seconds: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds);
      setCurrentTime(seconds);
    }
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    updateSettings({ volume: vol, isMuted: false });
    if (playerRef.current) {
      playerRef.current.setVolume(vol);
      playerRef.current.unMute();
    }
  }, [updateSettings]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = !settings.isMuted;
    updateSettings({ isMuted: nextMuted });
    if (playerRef.current) {
      if (nextMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(settings.volume);
      }
    }
  }, [settings.isMuted, settings.volume, updateSettings]);

  const handleClosePlayer = useCallback(() => {
    onResetToForm();
  }, [onResetToForm]);

  const handleOpenQuickAdd = useCallback(() => {
    nativeService.openQuickAdd();
  }, []);

  // Escutar evento automático de cookies importados
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    nativeService.onCookiesImported((payload) => {
      showToast(`🦊 ${payload.message}`);
      if (embedError) {
        setEmbedError(null);
        if (playerRef.current) {
          playerRef.current.reload();
        }
      }
    }).then((u) => {
      unlisten = u;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [embedError, showToast]);

  const handleImportBrowserCookies = useCallback(async (browser?: 'firefox' | 'chrome' | 'edge') => {
    setIsImporting(true);
    try {
      const msg = await nativeService.importBrowserCookies(browser);
      showToast(`✓ ${msg}`);
      if (embedError) {
        setEmbedError(null);
      }
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.reload();
        }
      }, 700);
    } catch (err: any) {
      const errMsg = err?.message || 'Não foi possível importar cookies deste navegador.';
      showToast(`⚠️ ${errMsg}`);
    } finally {
      setIsImporting(false);
    }
  }, [embedError, showToast]);

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const isMouseDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const clickTimerRef = useRef<number | null>(null);
  const lastFullscreenToggleRef = useRef(0);

  const safeToggleFullscreen = useCallback(() => {
    const now = Date.now();
    if (now - lastFullscreenToggleRef.current < 350) return;
    lastFullscreenToggleRef.current = now;
    nativeService.toggleFullscreen();
  }, []);

  const handleInteractionMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Se a fila estiver aberta, nenhum clique deve afetar o player
    if (isQueueOpenRef.current) return;

    const target = e.target as HTMLElement | null;
    // Se o clique foi em um botão, input, link, controle ou gaveta, ignora
    if (target && target.closest('button, input, textarea, a, .player-controls-overlay, .queue-drawer, .player-error-overlay')) {
      return;
    }

    isMouseDownRef.current = true;
    isDraggingRef.current = false;
    dragStartPos.current = { x: e.screenX, y: e.screenY };
    lastMousePos.current = { x: e.screenX, y: e.screenY };
  }, []);

  const handleInteractionMouseMove = useCallback((e: MouseEvent) => {
    // Se o botão esquerdo não estiver pressionado, cancela qualquer arraste imediatamente
    if ((e.buttons & 1) === 0) {
      isMouseDownRef.current = false;
      isDraggingRef.current = false;
      dragStartPos.current = null;
      lastMousePos.current = null;
      return;
    }

    if (!isMouseDownRef.current || !dragStartPos.current) return;

    const totalDx = e.screenX - dragStartPos.current.x;
    const totalDy = e.screenY - dragStartPos.current.y;
    const dist = Math.hypot(totalDx, totalDy);

    // Se moveu mais de 4 pixels, inicia o arraste nativo da janela
    if (dist >= 4 && !isDraggingRef.current) {
      isDraggingRef.current = true;
      // Cancela qualquer timer de clique simples pendente
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      // Inicia arraste nativo pelo OS Windows. Quando o usuário soltar o clique, o finally reseta os estados
      nativeService.startDragging().finally(() => {
        isMouseDownRef.current = false;
        isDraggingRef.current = false;
        dragStartPos.current = null;
        lastMousePos.current = null;
      });
    }
  }, []);

  const handleInteractionMouseUp = useCallback((e: MouseEvent) => {
    // Se o mousedown não iniciou validamente na camada do vídeo, IGNORE completamente!
    if (!isMouseDownRef.current) {
      return;
    }

    const wasDragging = isDraggingRef.current;
    isMouseDownRef.current = false;
    isDraggingRef.current = false;
    dragStartPos.current = null;
    lastMousePos.current = null;

    // Se estava arrastando, não dispara ação de clique
    if (wasDragging) {
      return;
    }

    // Se a fila estiver aberta, não altera o estado de reprodução
    if (isQueueOpenRef.current) {
      return;
    }

    // Se o mouseup aconteceu em algum botão, input ou controle, não alterna play/pause
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, textarea, a, .player-controls-overlay, .queue-drawer, .player-error-overlay')) {
      return;
    }

    // Clique legítimo na área livre do vídeo!
    if (clickTimerRef.current !== null) {
      // Segundo clique consecutivo dentro do intervalo -> TELA CHEIA (FULLSCREEN)!
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      safeToggleFullscreen();
    } else {
      // Primeiro clique: aguarda 240ms. Se não vier outro clique, alterna Play/Pause
      clickTimerRef.current = window.setTimeout(() => {
        clickTimerRef.current = null;
        handlePlayPause();
      }, 240);
    }
  }, [handlePlayPause, safeToggleFullscreen]);

  // Registra listeners de mousemove e mouseup na window com proteção de blur
  useEffect(() => {
    const onGlobalMouseMove = (e: MouseEvent) => handleInteractionMouseMove(e);
    const onGlobalMouseUp = (e: MouseEvent) => handleInteractionMouseUp(e);
    const onWindowReset = () => {
      isMouseDownRef.current = false;
      isDraggingRef.current = false;
      dragStartPos.current = null;
      lastMousePos.current = null;
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
    window.addEventListener('blur', onWindowReset);
    window.addEventListener('mouseleave', onWindowReset);

    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
      window.removeEventListener('blur', onWindowReset);
      window.removeEventListener('mouseleave', onWindowReset);
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current);
      }
    };
  }, [handleInteractionMouseMove, handleInteractionMouseUp]);

  const handleInteractionDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickTimerRef.current !== null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    safeToggleFullscreen();
  }, [safeToggleFullscreen]);

  const pendingCount = queue.filter((item, idx) => idx > currentIndex && item.status === 'pending').length;

  if (!currentItem) {
    return null;
  }

  return (
    <div
      className="mini-player-container"
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Toast Notification */}
      <Toast message={toastMessage} onDismiss={hideToast} />

      {/* Embed do YouTube */}
      <YoutubeEmbed
        ref={playerRef}
        videoId={currentItem.id}
        initialStartTime={savedStartTime}
        showCaptions={settings.showCaptions}
        volume={settings.volume}
        isMuted={settings.isMuted}
        onPlaying={() => {
          setIsPlaying(true);
          setEmbedError(null);
        }}
        onPaused={() => {
          setIsPlaying(false);
          if (currentItem && currentTime > 2) {
            savePlaybackPosition(currentItem.id, currentTime);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (currentItem) {
            clearSavedPosition(currentItem.id);
          }
          nextVideo();
        }}
        onError={(code, message) => {
          setIsPlaying(false);
          setEmbedError({ code, message });
          handleVideoError(message);
        }}
      />

      {/* Camada interativa transparente sobre o vídeo: clique para play/pause, duplo clique para tela cheia e arrasto suave da janela */}
      <div
        className="video-interaction-layer"
        onMouseDown={handleInteractionMouseDown}
        onDoubleClick={handleInteractionDoubleClick}
      />

      {/* Alerta de erro de incorporação com opções de login e importação */}
      {embedError && (
        <div className="player-error-overlay">
          <AlertCircle size={24} className="text-danger" />
          <p className="error-title">{embedError.message}</p>
          <div className="error-actions auth-actions">
            <button
              className="error-btn highlight"
              onClick={() => handleImportBrowserCookies('firefox')}
              disabled={isImporting}
              title="Importar sessão do Firefox agora"
            >
              🦊 Importar do Firefox
            </button>
            <button
              className="error-btn"
              onClick={() => nativeService.openAuthWindow()}
              title="Abrir tela de login e detecção de navegadores"
            >
              🔑 Conectar / Login
            </button>
            <button
              className="error-btn outline"
              onClick={() => {
                setEmbedError(null);
                playerRef.current?.reload();
              }}
              title="Recarregar player"
            >
              <RefreshCw size={12} /> Recarregar
            </button>
            <button className="error-btn ghost" onClick={() => nextVideo()}>
              Pular vídeo
            </button>
            <a
              href={currentItem.url}
              target="_blank"
              rel="noreferrer"
              className="error-btn ghost"
              title="Abrir no navegador padrão"
            >
              <ExternalLink size={12} /> YouTube Web
            </a>
          </div>
        </div>
      )}

      {/* Controles Flutuantes (Hover) */}
      <PlayerControls
        isVisible={areControlsVisible && !isQueueOpen}
        isPlaying={isPlaying}
        currentItem={currentItem}
        hasPrevious={currentIndex > 0}
        hasNext={currentIndex < queue.length - 1}
        pendingCount={pendingCount}
        alwaysOnTop={settings.alwaysOnTop}
        showCaptions={settings.showCaptions}
        volume={settings.volume}
        isMuted={settings.isMuted}
        currentTime={currentTime}
        duration={duration}
        preset={settings.preset}
        onPlayPause={handlePlayPause}
        onPrevious={previousVideo}
        onNext={nextVideo}
        onSeek={handleSeek}
        onToggleMute={handleToggleMute}
        onToggleCaptions={toggleCaptions}
        onVolumeChange={handleVolumeChange}
        onToggleAlwaysOnTop={toggleAlwaysOnTop}
        onToggleQueue={() => setIsQueueOpen((prev) => !prev)}
        onOpenQuickAdd={handleOpenQuickAdd}
        onChangePreset={changePreset}
        onResetVideo={() => handleSeek(0)}
        onToggleFullscreen={() => nativeService.toggleFullscreen()}
        onOpenAuthModal={() => nativeService.openAuthWindow()}
        onClose={handleClosePlayer}
      />

      {/* Gaveta de Fila de Reprodução e Playlists */}
      <QueueDrawer
        isOpen={isQueueOpen}
        queue={queue}
        currentIndex={currentIndex}
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        onClose={() => setIsQueueOpen(false)}
        onPlayItem={playItemAt}
        onRemoveItem={removeItem}
        onClearQueue={clearQueue}
        onReorder={reorderQueue}
        onAddNew={(url) => addToQueue(url, false)}
        onCopyLink={() => showToast('Link copiado para a área de transferência!')}
        onCreatePlaylist={createPlaylist}
        onSwitchPlaylist={switchPlaylist}
        onRenamePlaylist={renamePlaylist}
        onDeletePlaylist={deletePlaylist}
      />
    </div>
  );
};
