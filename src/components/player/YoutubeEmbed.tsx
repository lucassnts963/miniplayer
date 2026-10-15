import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { loadYouTubeIFrameAPI } from '../../services/youtube.service';

export interface YoutubeEmbedRef {
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  toggleCaptions: (enabled: boolean) => void;
  reload: () => void;
}

interface YoutubeEmbedProps {
  videoId: string;
  volume: number;
  isMuted: boolean;
  showCaptions?: boolean;
  initialStartTime?: number;
  onEnded: () => void;
  onPlaying?: () => void;
  onPaused?: () => void;
  onError?: (errorCode: number, message: string) => void;
  onReady?: () => void;
}

export const YoutubeEmbed = forwardRef<YoutubeEmbedRef, YoutubeEmbedProps>(({
  videoId,
  volume,
  isMuted,
  showCaptions = false,
  initialStartTime = 0,
  onEnded,
  onPlaying,
  onPaused,
  onError,
  onReady,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [playerHost, setPlayerHost] = useState<'https://www.youtube.com' | 'https://www.youtube-nocookie.com'>('https://www.youtube.com');
  const currentVideoIdRef = useRef<string>(videoId);
  const onEndedRef = useRef(onEnded);
  const onErrorRef = useRef(onError);
  const onPlayingRef = useRef(onPlaying);
  const onPausedRef = useRef(onPaused);

  onEndedRef.current = onEnded;
  onErrorRef.current = onError;
  onPlayingRef.current = onPlaying;
  onPausedRef.current = onPaused;
  currentVideoIdRef.current = videoId;

  // Expor controles via ref
  useImperativeHandle(ref, () => ({
    play: () => {
      if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      }
    },
    pause: () => {
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        playerRef.current.pauseVideo();
      }
    },
    togglePlay: () => {
      if (playerRef.current) {
        const state = playerRef.current.getPlayerState();
        if (state === 1) {
          playerRef.current.pauseVideo();
        } else {
          playerRef.current.playVideo();
        }
      }
    },
    seekTo: (seconds: number) => {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        playerRef.current.seekTo(seconds, true);
      }
    },
    setVolume: (vol: number) => {
      if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(vol);
      }
    },
    mute: () => {
      if (playerRef.current && typeof playerRef.current.mute === 'function') {
        playerRef.current.mute();
      }
    },
    unMute: () => {
      if (playerRef.current && typeof playerRef.current.unMute === 'function') {
        playerRef.current.unMute();
      }
    },
    getCurrentTime: () => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        return playerRef.current.getCurrentTime() || 0;
      }
      return 0;
    },
    getDuration: () => {
      if (playerRef.current && typeof playerRef.current.getDuration === 'function') {
        return playerRef.current.getDuration() || 0;
      }
      return 0;
    },
    toggleCaptions: (enabled: boolean) => {
      syncCaptions(enabled);
    },
    reload: () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
      setReloadKey((prev) => prev + 1);
    },
  }));

  const syncCaptions = (enabled: boolean) => {
    if (!playerRef.current) return;
    try {
      if (enabled) {
        if (typeof playerRef.current.loadModule === 'function') {
          playerRef.current.loadModule('captions');
        }
        if (typeof playerRef.current.setOption === 'function') {
          playerRef.current.setOption('captions', 'track', { languageCode: 'pt' });
        }
      } else {
        if (typeof playerRef.current.unloadModule === 'function') {
          playerRef.current.unloadModule('captions');
        }
        if (typeof playerRef.current.setOption === 'function') {
          playerRef.current.setOption('captions', 'track', {});
        }
      }
    } catch (err) {
      console.warn('Erro ao alternar legendas no YouTube embed:', err);
    }
  };

  // Carregar YouTube IFrame API
  useEffect(() => {
    loadYouTubeIFrameAPI().then(() => {
      setIsApiReady(true);
    });
  }, []);

  // Sincronizar legendas quando a prop showCaptions mudar
  useEffect(() => {
    syncCaptions(showCaptions);
  }, [showCaptions]);

  // Inicializar Player ou atualizar vídeo
  useEffect(() => {
    if (!isApiReady || !containerRef.current || !videoId) return;

    if (!playerRef.current) {
      // Cria a instância única do player
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        host: playerHost,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          cc_load_policy: showCaptions ? 1 : 0,
          start: initialStartTime && initialStartTime > 0 ? Math.floor(initialStartTime) : 0,
          disablekb: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          widget_referrer: 'https://www.youtube.com',
        },
        events: {
          onReady: (event: any) => {
            if (isMuted) {
              event.target.mute();
            } else {
              event.target.unMute();
              event.target.setVolume(volume);
            }
            if (initialStartTime && initialStartTime > 0) {
              event.target.seekTo(initialStartTime, true);
            }
            syncCaptions(showCaptions);
            event.target.playVideo();
            if (onReady) onReady();
          },
          onApiChange: () => {
            syncCaptions(showCaptions);
          },
          onStateChange: (event: any) => {
            // YT.PlayerState:
            // 0: ENDED, 1: PLAYING, 2: PAUSED, 3: BUFFERING, 5: CUED
            if (event.data === 0) {
              if (onEndedRef.current) onEndedRef.current();
            } else if (event.data === 1) {
              syncCaptions(showCaptions);
              if (onPlayingRef.current) onPlayingRef.current();
            } else if (event.data === 2) {
              if (onPausedRef.current) onPausedRef.current();
            }
          },
          onError: (event: any) => {
            const errCode = event.data;
            let msg = 'Erro ao reproduzir vídeo';
            if (errCode === 101 || errCode === 150) {
              // Se falhou no domínio padrão, tenta automaticamente no nocookie uma vez
              if (playerHost === 'https://www.youtube.com') {
                setPlayerHost('https://www.youtube-nocookie.com');
                if (playerRef.current && typeof playerRef.current.destroy === 'function') {
                  try {
                    playerRef.current.destroy();
                  } catch {}
                  playerRef.current = null;
                }
                setReloadKey((prev) => prev + 1);
                return;
              }
              msg = 'Este vídeo requer login ou restringe incorporação. Conecte sua conta do YouTube ou Firefox abaixo.';
            } else if (errCode === 100) {
              msg = 'Vídeo não encontrado ou removido';
            } else if (errCode === 2) {
              msg = 'ID de vídeo inválido';
            }
            if (onErrorRef.current) onErrorRef.current(errCode, msg);
          },
        },
      });
    } else {
      // Reutiliza a instância existente carregando novo vídeo diretamente
      try {
        playerRef.current.loadVideoById({
          videoId,
          startSeconds: initialStartTime && initialStartTime > 0 ? initialStartTime : 0,
        });
        setTimeout(() => {
          syncCaptions(showCaptions);
        }, 500);
      } catch (err) {
        console.warn('Erro ao carregar novo vídeo pelo player:', err);
      }
    }
  }, [isApiReady, videoId, reloadKey, playerHost]);

  // Sincronizar volume e mute
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      try {
        if (isMuted) {
          playerRef.current.mute();
        } else {
          playerRef.current.unMute();
          playerRef.current.setVolume(volume);
        }
      } catch {
        // Ignora erros de chamada antecipada
      }
    }
  }, [volume, isMuted]);

  return (
    <div className="youtube-player-wrapper">
      <div ref={containerRef} className="youtube-iframe-container" />
    </div>
  );
});

YoutubeEmbed.displayName = 'YoutubeEmbed';
