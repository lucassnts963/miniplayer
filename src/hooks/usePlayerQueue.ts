import { useState, useEffect, useCallback } from 'react';
import { QueueItem, Playlist, PlayerSettings, WindowPreset, QuickAddPayload } from '../types/player.types';
import { parseYouTubeUrl } from '../utils/youtube-url';
import { fetchVideoMetadata } from '../services/youtube.service';
import { nativeService } from '../services/native.service';

const STORAGE_KEY_PLAYLISTS = 'miniplayer_playlists_v2';
const STORAGE_KEY_ACTIVE_PLAYLIST_ID = 'miniplayer_active_playlist_id_v2';
const STORAGE_KEY_SETTINGS = 'miniplayer_settings_v1';
const STORAGE_KEY_PLAYBACK_POSITIONS = 'miniplayer_playback_positions_v1';

// Legacy keys for migration
const STORAGE_KEY_QUEUE_V1 = 'miniplayer_queue_v1';
const STORAGE_KEY_CURRENT_INDEX_V1 = 'miniplayer_current_index_v1';

const DEFAULT_SETTINGS: PlayerSettings = {
  alwaysOnTop: true,
  autoPlayNext: true,
  avoidDuplicates: true,
  volume: 100,
  isMuted: false,
  preset: 'medium',
  showCaptions: false,
};

export function usePlayerQueue() {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAYLISTS);
      if (saved) {
        const parsed: Playlist[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar playlists:', e);
    }

    // Migração de fila legada v1
    try {
      const legacyQueue = localStorage.getItem(STORAGE_KEY_QUEUE_V1);
      const legacyIndex = localStorage.getItem(STORAGE_KEY_CURRENT_INDEX_V1);
      const parsedQueue: QueueItem[] = legacyQueue ? JSON.parse(legacyQueue) : [];
      const parsedIndex = legacyIndex !== null ? parseInt(legacyIndex, 10) : -1;
      return [
        {
          id: 'default',
          name: 'Fila Principal',
          items: parsedQueue,
          currentIndex: isNaN(parsedIndex) ? -1 : parsedIndex,
          createdAt: Date.now(),
        },
      ];
    } catch {
      return [
        {
          id: 'default',
          name: 'Fila Principal',
          items: [],
          currentIndex: -1,
          createdAt: Date.now(),
        },
      ];
    }
  });

  const [activePlaylistId, setActivePlaylistId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_PLAYLIST_ID);
      if (saved) return saved;
    } catch {}
    return 'default';
  });

  const [settings, setSettings] = useState<PlayerSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const hideToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // Salvar playlists no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(playlists));
      const active = playlists.find((p) => p.id === activePlaylistId) || playlists[0];
      if (active) {
        localStorage.setItem(STORAGE_KEY_QUEUE_V1, JSON.stringify(active.items));
        localStorage.setItem(STORAGE_KEY_CURRENT_INDEX_V1, active.currentIndex.toString());
      }
    } catch (e) {
      console.warn('Erro ao salvar playlists:', e);
    }
  }, [playlists, activePlaylistId]);

  // Salvar activePlaylistId
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PLAYLIST_ID, activePlaylistId);
    } catch (e) {
      console.warn('Erro ao salvar activePlaylistId:', e);
    }
  }, [activePlaylistId]);

  // Salvar settings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('Erro ao salvar configurações:', e);
    }
  }, [settings]);

  // Obter playlist ativa
  const activePlaylist =
    playlists.find((p) => p.id === activePlaylistId) ||
    playlists[0] || {
      id: 'default',
      name: 'Fila Principal',
      items: [],
      currentIndex: -1,
      createdAt: Date.now(),
    };

  const queue = activePlaylist.items;
  const currentIndex = activePlaylist.currentIndex;
  const currentItem =
    currentIndex >= 0 && currentIndex < queue.length ? queue[currentIndex] : null;

  // Criar nova playlist
  const createPlaylist = useCallback(
    (name?: string, initialItems: QueueItem[] = [], makeActive: boolean = true): Playlist => {
      const newId = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newName = name?.trim() || `Playlist ${playlists.length + 1}`;
      const newPlaylist: Playlist = {
        id: newId,
        name: newName,
        items: initialItems,
        currentIndex: initialItems.length > 0 ? 0 : -1,
        createdAt: Date.now(),
      };

      setPlaylists((prev) => [...prev, newPlaylist]);
      if (makeActive) {
        setActivePlaylistId(newId);
      }
      showToast(`Playlist "${newName}" criada!`);
      return newPlaylist;
    },
    [playlists.length, showToast]
  );

  // Trocar de playlist ("escolhendo qual vai dar player")
  const switchPlaylist = useCallback(
    (playlistId: string, playImmediately: boolean = false) => {
      const target = playlists.find((p) => p.id === playlistId);
      if (!target) return;
      setActivePlaylistId(playlistId);

      if (playImmediately) {
        if (target.items.length > 0) {
          setPlaylists((prev) =>
            prev.map((p) => {
              if (p.id === playlistId) {
                const nextIdx =
                  p.currentIndex >= 0 && p.currentIndex < p.items.length ? p.currentIndex : 0;
                return {
                  ...p,
                  currentIndex: nextIdx,
                  items: p.items.map((item, idx) => ({
                    ...item,
                    status: idx === nextIdx ? 'playing' : idx < nextIdx ? 'played' : 'pending',
                  })),
                };
              }
              return p;
            })
          );
          showToast(`Tocando playlist: "${target.name}"`);
        } else {
          showToast(`Playlist selecionada: "${target.name}" (vazia)`);
        }
      } else {
        showToast(`Playlist selecionada: "${target.name}"`);
      }
    },
    [playlists, showToast]
  );

  // Renomear playlist
  const renamePlaylist = useCallback(
    (playlistId: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      setPlaylists((prev) =>
        prev.map((p) => (p.id === playlistId ? { ...p, name: trimmed } : p))
      );
      showToast(`Playlist renomeada para "${trimmed}"`);
    },
    [showToast]
  );

  // Excluir playlist
  const deletePlaylist = useCallback(
    (playlistId: string) => {
      if (playlists.length <= 1) {
        setPlaylists([
          {
            id: 'default',
            name: 'Fila Principal',
            items: [],
            currentIndex: -1,
            createdAt: Date.now(),
          },
        ]);
        setActivePlaylistId('default');
        showToast('Playlist redefinida para Fila Principal');
        return;
      }

      const toDelete = playlists.find((p) => p.id === playlistId);
      setPlaylists((prev) => {
        const filtered = prev.filter((p) => p.id !== playlistId);
        if (activePlaylistId === playlistId) {
          setActivePlaylistId(filtered[0].id);
        }
        return filtered;
      });
      showToast(`Playlist "${toDelete?.name || ''}" excluída`);
    },
    [playlists, activePlaylistId, showToast]
  );

  // Adicionar vídeo ou playlist à lista
  const addToQueue = useCallback(
    async (
      urlOrId: string,
      playImmediately: boolean = false,
      targetPlaylistId?: string
    ): Promise<{ success: boolean; message: string }> => {
      const destPlaylistId = targetPlaylistId || activePlaylistId;
      const parsed = parseYouTubeUrl(urlOrId);
      if (!parsed.isValid) {
        showToast('Link do YouTube inválido');
        return { success: false, message: 'Link do YouTube inválido' };
      }

      // Caso 1: Playlist do YouTube (qualquer link com playlistId, incluindo watch?v=...&list=...)
      if (parsed.playlistId) {
        showToast('Carregando vídeos da playlist...');
        try {
          const playlistResult = await nativeService.fetchYouTubePlaylist(urlOrId);
          if (!playlistResult.items || playlistResult.items.length === 0) {
            showToast('Playlist vazia ou privada');
            return { success: false, message: 'Playlist vazia ou privada' };
          }

          let itemsToAdd = playlistResult.items;
          const targetPl = playlists.find((p) => p.id === destPlaylistId) || activePlaylist;

          if (settings.avoidDuplicates) {
            const existingIds = new Set(targetPl.items.map((item) => item.id));
            itemsToAdd = itemsToAdd.filter((item) => !existingIds.has(item.id));
          }

          if (itemsToAdd.length === 0) {
            showToast('Todos os vídeos da playlist já estão na fila');
            return { success: false, message: 'Todos os vídeos da playlist já existem na fila' };
          }

          const now = Date.now();
          const newQueueItems: QueueItem[] = itemsToAdd.map((item, idx) => ({
            id: item.id,
            url: item.url,
            title: item.title,
            thumbnail: item.thumbnail,
            status: 'pending',
            addedAt: now + idx,
          }));

          const shouldRename =
            (targetPl.name === 'Fila Principal' || targetPl.name.startsWith('Playlist ')) &&
            targetPl.items.length === 0 &&
            Boolean(playlistResult.title);

          const startIndex = targetPl.items.length;
          // Se o link continha um vídeo específico (watch?v=...&list=...), inicia nele
          const targetVideoOffset = parsed.videoId
            ? itemsToAdd.findIndex((item) => item.id === parsed.videoId)
            : 0;
          const playIndex = targetVideoOffset >= 0 ? startIndex + targetVideoOffset : startIndex;

          setPlaylists((prev) =>
            prev.map((p) => {
              if (p.id === destPlaylistId) {
                const updatedItems = [...p.items, ...newQueueItems];
                const shouldStart = playImmediately || p.currentIndex === -1 || p.items.length === 0;
                const nextIndex = shouldStart ? playIndex : p.currentIndex;
                return {
                  ...p,
                  name: shouldRename && playlistResult.title ? playlistResult.title : p.name,
                  items: shouldStart
                    ? updatedItems.map((item, idx) => ({
                        ...item,
                        status: idx === nextIndex ? 'playing' : idx < nextIndex ? 'played' : 'pending',
                      }))
                    : updatedItems,
                  currentIndex: nextIndex,
                };
              }
              return p;
            })
          );

          if (destPlaylistId !== activePlaylistId && playImmediately) {
            setActivePlaylistId(destPlaylistId);
          }

          showToast(
            playlistResult.title
              ? `Playlist "${playlistResult.title}": ${itemsToAdd.length} vídeos adicionados!`
              : `${itemsToAdd.length} vídeos da playlist adicionados!`
          );

          return {
            success: true,
            message: `${itemsToAdd.length} vídeos adicionados da playlist`,
          };
        } catch (err: any) {
          console.error('Erro ao buscar playlist:', err);
          const errMsg = typeof err === 'string' ? err : err?.message || 'Erro ao carregar playlist';
          showToast(errMsg);
          return { success: false, message: errMsg };
        }
      }

      // Caso 2: Vídeo único do YouTube
      if (!parsed.videoId) {
        showToast('ID do vídeo não encontrado');
        return { success: false, message: 'ID do vídeo não encontrado' };
      }

      const videoId = parsed.videoId;
      const targetPl = playlists.find((p) => p.id === destPlaylistId) || activePlaylist;

      if (settings.avoidDuplicates) {
        const alreadyExists = targetPl.items.some((item) => item.id === videoId);
        if (alreadyExists) {
          if (playImmediately) {
            const existingIndex = targetPl.items.findIndex((item) => item.id === videoId);
            setPlaylists((prev) =>
              prev.map((p) => {
                if (p.id === destPlaylistId) {
                  return {
                    ...p,
                    currentIndex: existingIndex,
                    items: p.items.map((item, idx) => ({
                      ...item,
                      status:
                        idx === existingIndex ? 'playing' : idx < existingIndex ? 'played' : 'pending',
                    })),
                  };
                }
                return p;
              })
            );
            if (destPlaylistId !== activePlaylistId) {
              setActivePlaylistId(destPlaylistId);
            }
            showToast('Reproduzindo vídeo existente');
            return { success: true, message: 'Vídeo já na fila, iniciado' };
          }
          showToast('Vídeo já está na fila');
          return { success: false, message: 'Vídeo já existe na fila' };
        }
      }

      const meta = await fetchVideoMetadata(urlOrId);
      const newItem: QueueItem = {
        id: videoId,
        url: parsed.canonicalUrl,
        title: meta?.title || `Vídeo (${videoId})`,
        thumbnail: meta?.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        status: 'pending',
        addedAt: Date.now(),
      };

      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id === destPlaylistId) {
            const updatedItems = [...p.items, newItem];
            const shouldStart = playImmediately || p.currentIndex === -1 || p.items.length === 0;
            const nextIndex = shouldStart ? updatedItems.length - 1 : p.currentIndex;
            return {
              ...p,
              items: shouldStart
                ? updatedItems.map((item, idx) => ({
                    ...item,
                    status: idx === nextIndex ? 'playing' : idx < nextIndex ? 'played' : 'pending',
                  }))
                : updatedItems,
              currentIndex: nextIndex,
            };
          }
          return p;
        })
      );

      if (destPlaylistId !== activePlaylistId && playImmediately) {
        setActivePlaylistId(destPlaylistId);
      }

      showToast(playImmediately ? 'Reproduzindo agora' : 'Vídeo adicionado à fila');
      return { success: true, message: 'Adicionado com sucesso' };
    },
    [activePlaylistId, activePlaylist, playlists, settings.avoidDuplicates, showToast]
  );

  // Avançar para o próximo vídeo
  const nextVideo = useCallback(() => {
    if (queue.length === 0) return;

    let nextIdx = currentIndex + 1;
    while (nextIdx < queue.length && queue[nextIdx].status === 'error') {
      nextIdx++;
    }

    if (nextIdx < queue.length) {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id === activePlaylistId) {
            return {
              ...p,
              currentIndex: nextIdx,
              items: p.items.map((item, idx) => ({
                ...item,
                status: idx === nextIdx ? 'playing' : idx < nextIdx ? 'played' : item.status,
              })),
            };
          }
          return p;
        })
      );
      showToast(`Próximo: ${queue[nextIdx].title}`);
    } else {
      showToast('Fim da fila de reprodução');
    }
  }, [activePlaylistId, queue, currentIndex, showToast]);

  // Voltar para o vídeo anterior
  const previousVideo = useCallback(() => {
    if (queue.length === 0) return;

    let prevIdx = currentIndex - 1;
    while (prevIdx >= 0 && queue[prevIdx].status === 'error') {
      prevIdx--;
    }

    if (prevIdx >= 0) {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id === activePlaylistId) {
            return {
              ...p,
              currentIndex: prevIdx,
              items: p.items.map((item, idx) => ({
                ...item,
                status: idx === prevIdx ? 'playing' : idx < prevIdx ? 'played' : 'pending',
              })),
            };
          }
          return p;
        })
      );
      showToast(`Anterior: ${queue[prevIdx].title}`);
    } else {
      showToast('Início da fila');
    }
  }, [activePlaylistId, queue, currentIndex, showToast]);

  // Pular para um item específico
  const playItemAt = useCallback(
    (index: number) => {
      if (index >= 0 && index < queue.length) {
        setPlaylists((prev) =>
          prev.map((p) => {
            if (p.id === activePlaylistId) {
              return {
                ...p,
                currentIndex: index,
                items: p.items.map((item, idx) => ({
                  ...item,
                  status: idx === index ? 'playing' : idx < index ? 'played' : 'pending',
                })),
              };
            }
            return p;
          })
        );
      }
    },
    [activePlaylistId, queue.length]
  );

  // Remover item
  const removeItem = useCallback(
    (index: number) => {
      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id === activePlaylistId) {
            const nextQueue = p.items.filter((_, idx) => idx !== index);
            let nextIndex = p.currentIndex;
            if (index === p.currentIndex) {
              if (nextQueue.length === 0) {
                nextIndex = -1;
              } else if (index < nextQueue.length) {
                nextIndex = index;
              } else {
                nextIndex = nextQueue.length - 1;
              }
            } else if (index < p.currentIndex) {
              nextIndex = p.currentIndex - 1;
            }
            return {
              ...p,
              items: nextQueue,
              currentIndex: nextIndex,
            };
          }
          return p;
        })
      );
      showToast('Vídeo removido da fila');
    },
    [activePlaylistId, showToast]
  );

  // Limpar fila atual
  const clearQueue = useCallback(() => {
    setPlaylists((prev) =>
      prev.map((p) => {
        if (p.id === activePlaylistId) {
          return {
            ...p,
            items: [],
            currentIndex: -1,
          };
        }
        return p;
      })
    );
    showToast('Fila limpa');
  }, [activePlaylistId, showToast]);

  // Reordenar itens (mover de fromIndex para toIndex)
  const reorderQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex < 0 ||
        fromIndex >= queue.length ||
        toIndex < 0 ||
        toIndex >= queue.length
      )
        return;

      setPlaylists((prev) =>
        prev.map((p) => {
          if (p.id === activePlaylistId) {
            const updated = [...p.items];
            const [moved] = updated.splice(fromIndex, 1);
            updated.splice(toIndex, 0, moved);

            let nextIndex = p.currentIndex;
            if (p.currentIndex === fromIndex) {
              nextIndex = toIndex;
            } else if (fromIndex < p.currentIndex && toIndex >= p.currentIndex) {
              nextIndex = p.currentIndex - 1;
            } else if (fromIndex > p.currentIndex && toIndex <= p.currentIndex) {
              nextIndex = p.currentIndex + 1;
            }

            return {
              ...p,
              items: updated,
              currentIndex: nextIndex,
            };
          }
          return p;
        })
      );
    },
    [activePlaylistId, queue.length]
  );

  // Marcar vídeo atual com erro e pular para o próximo
  const handleVideoError = useCallback(
    (errorMessage: string) => {
      if (currentIndex >= 0 && currentIndex < queue.length) {
        setPlaylists((prev) =>
          prev.map((p) => {
            if (p.id === activePlaylistId) {
              return {
                ...p,
                items: p.items.map((item, idx) =>
                  idx === p.currentIndex ? { ...item, status: 'error', errorMessage } : item
                ),
              };
            }
            return p;
          })
        );
        showToast(`Vídeo indisponível: pulando...`);
        setTimeout(() => {
          nextVideo();
        }, 1000);
      }
    },
    [activePlaylistId, currentIndex, queue.length, nextVideo, showToast]
  );

  // Atualizar configurações
  const updateSettings = useCallback((newSettings: Partial<PlayerSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  // Alternar Always on Top nativo
  const toggleAlwaysOnTop = useCallback(async () => {
    const nextState = await nativeService.toggleAlwaysOnTop();
    setSettings((prev) => ({ ...prev, alwaysOnTop: nextState }));
    showToast(nextState ? 'Sempre no topo: ativado' : 'Sempre no topo: desativado');
  }, [showToast]);

  // Alternar Legendas (Closed Captions)
  const toggleCaptions = useCallback(() => {
    setSettings((prev) => {
      const next = !prev.showCaptions;
      showToast(next ? 'Legendas ativadas' : 'Legendas desativadas');
      return { ...prev, showCaptions: next };
    });
  }, [showToast]);

  // Obter posição salva de um vídeo
  const getSavedPosition = useCallback((videoId: string): number => {
    if (!videoId) return 0;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAYBACK_POSITIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return typeof parsed[videoId] === 'number' ? parsed[videoId] : 0;
      }
    } catch {}
    return 0;
  }, []);

  // Gravar onde o vídeo parou
  const savePlaybackPosition = useCallback((videoId: string, seconds: number) => {
    if (!videoId || isNaN(seconds) || seconds < 0) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAYBACK_POSITIONS);
      const parsed = saved ? JSON.parse(saved) : {};
      parsed[videoId] = Math.floor(seconds);
      localStorage.setItem(STORAGE_KEY_PLAYBACK_POSITIONS, JSON.stringify(parsed));
    } catch {}
  }, []);

  // Limpar posição salva
  const clearSavedPosition = useCallback((videoId: string) => {
    if (!videoId) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PLAYBACK_POSITIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed[videoId];
        localStorage.setItem(STORAGE_KEY_PLAYBACK_POSITIONS, JSON.stringify(parsed));
      }
    } catch {}
  }, []);

  // Alterar preset de tamanho
  const changePreset = useCallback(async (preset: WindowPreset) => {
    await nativeService.setWindowPreset(preset);
    setSettings((prev) => ({ ...prev, preset }));
  }, []);

  // Listeners para atalhos globais de Próximo e Anterior via Tauri Events
  useEffect(() => {
    let unlistenNext: (() => void) | undefined;
    let unlistenPrev: (() => void) | undefined;
    let unlistenQuickAdd: (() => void) | undefined;

    nativeService
      .onShortcutNext(() => {
        nextVideo();
      })
      .then((u) => {
        unlistenNext = u;
      });

    nativeService
      .onShortcutPrevious(() => {
        previousVideo();
      })
      .then((u) => {
        unlistenPrev = u;
      });

    nativeService
      .onQuickAddReceived((payload: QuickAddPayload) => {
        addToQueue(payload.url, payload.playNow);
      })
      .then((u) => {
        unlistenQuickAdd = u;
      });

    return () => {
      if (unlistenNext) unlistenNext();
      if (unlistenPrev) unlistenPrev();
      if (unlistenQuickAdd) unlistenQuickAdd();
    };
  }, [nextVideo, previousVideo, addToQueue]);

  return {
    playlists,
    activePlaylistId,
    activePlaylist,
    queue,
    currentIndex,
    currentItem,
    settings,
    toastMessage,
    showToast,
    hideToast,
    addToQueue,
    createPlaylist,
    switchPlaylist,
    renamePlaylist,
    deletePlaylist,
    nextVideo,
    previousVideo,
    playItemAt,
    removeItem,
    clearQueue,
    reorderQueue,
    handleVideoError,
    updateSettings,
    toggleAlwaysOnTop,
    changePreset,
    toggleCaptions,
    getSavedPosition,
    savePlaybackPosition,
    clearSavedPosition,
  };
}
