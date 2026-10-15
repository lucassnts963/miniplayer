import React, { useState } from 'react';
import {
  X,
  Trash2,
  Play,
  ArrowUp,
  ArrowDown,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  ListPlus,
  Copy,
  Check,
  ChevronDown,
  Edit2,
  FolderPlus,
} from 'lucide-react';
import { QueueItem, Playlist } from '../../types/player.types';
import { nativeService } from '../../services/native.service';

interface QueueDrawerProps {
  isOpen: boolean;
  queue: QueueItem[];
  currentIndex: number;
  playlists: Playlist[];
  activePlaylistId: string;
  onClose: () => void;
  onPlayItem: (index: number) => void;
  onRemoveItem: (index: number) => void;
  onClearQueue: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onAddNew: (url: string) => void;
  onCopyLink?: (url: string) => void;
  onCreatePlaylist: (name?: string) => void;
  onSwitchPlaylist: (playlistId: string, playImmediately?: boolean) => void;
  onRenamePlaylist: (playlistId: string, newName: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
}

export const QueueDrawer: React.FC<QueueDrawerProps> = ({
  isOpen,
  queue,
  currentIndex,
  playlists,
  activePlaylistId,
  onClose,
  onPlayItem,
  onRemoveItem,
  onClearQueue,
  onReorder,
  onAddNew,
  onCopyLink,
  onCreatePlaylist,
  onSwitchPlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
}) => {
  const [newUrl, setNewUrl] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Estados de gerenciamento de playlists
  const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isRenamingPlaylist, setIsRenamingPlaylist] = useState(false);
  const [playlistNameInput, setPlaylistNameInput] = useState('');

  if (!isOpen) return null;

  const activePlaylist =
    playlists.find((p) => p.id === activePlaylistId) ||
    playlists[0] || {
      id: 'default',
      name: 'Fila Principal',
      items: queue,
      currentIndex,
      createdAt: Date.now(),
    };

  const handleCopyLink = async (url: string, id: string) => {
    const fullUrl = url && url.startsWith('http') ? url : `https://www.youtube.com/watch?v=${id}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(id);
      if (onCopyLink) {
        onCopyLink(fullUrl);
      }
      setTimeout(() => {
        setCopiedId(null);
      }, 1500);
    } catch (err) {
      console.warn('Erro ao copiar link:', err);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUrl.trim()) {
      onAddNew(newUrl.trim());
      setNewUrl('');
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playlistNameInput.trim()) {
      onCreatePlaylist(playlistNameInput.trim());
      setPlaylistNameInput('');
      setIsCreatingPlaylist(false);
      setIsPlaylistMenuOpen(false);
    }
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playlistNameInput.trim()) {
      onRenamePlaylist(activePlaylist.id, playlistNameInput.trim());
      setPlaylistNameInput('');
      setIsRenamingPlaylist(false);
    }
  };

  return (
    <div
      className="queue-drawer-backdrop"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="queue-drawer"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho da Fila e Playlists */}
        <div
          className="queue-header"
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.button === 0 && !(e.target as HTMLElement).closest('button, input')) {
              nativeService.startDragging();
            }
          }}
        >
          {/* Seletor Dropdown de Playlists */}
          <div className="queue-header-left">
            <button
              type="button"
              className={`playlist-selector-trigger ${isPlaylistMenuOpen ? 'active' : ''}`}
              onClick={() => {
                setIsPlaylistMenuOpen((prev) => !prev);
                setIsCreatingPlaylist(false);
                setIsRenamingPlaylist(false);
              }}
              title="Alternar ou gerenciar playlists"
            >
              <ListPlus size={14} className="text-accent" />
              <span className="playlist-title-text">{activePlaylist.name}</span>
              <span className="playlist-badge-count">{queue.length}</span>
              <ChevronDown
                size={12}
                className={`chevron-icon ${isPlaylistMenuOpen ? 'open' : ''}`}
              />
            </button>
          </div>

          <div className="queue-header-actions">
            {/* Botão de Renomear Playlist Atual */}
            <button
              type="button"
              className="icon-btn mini"
              title="Renomear playlist atual"
              onClick={() => {
                setPlaylistNameInput(activePlaylist.name);
                setIsRenamingPlaylist(true);
                setIsCreatingPlaylist(false);
                setIsPlaylistMenuOpen(false);
              }}
            >
              <Edit2 size={12} />
            </button>

            {/* Botão de Nova Playlist Rápida */}
            <button
              type="button"
              className="icon-btn mini"
              title="Criar nova playlist"
              onClick={() => {
                setPlaylistNameInput('');
                setIsCreatingPlaylist(true);
                setIsRenamingPlaylist(false);
                setIsPlaylistMenuOpen(false);
              }}
            >
              <FolderPlus size={13} />
            </button>

            {/* Limpar Fila */}
            {queue.length > 0 && (
              <>
                {showClearConfirm ? (
                  <div className="clear-confirm-group">
                    <button
                      className="confirm-btn danger"
                      onClick={() => {
                        onClearQueue();
                        setShowClearConfirm(false);
                      }}
                    >
                      Limpar?
                    </button>
                    <button className="confirm-btn" onClick={() => setShowClearConfirm(false)}>
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    className="icon-btn text-danger mini"
                    title="Limpar todos os vídeos desta playlist"
                    onClick={() => setShowClearConfirm(true)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            )}

            {/* Fechar Fila */}
            <button className="icon-btn mini" title="Fechar fila (Esc)" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Modal / Formulário de Criação de Playlist */}
        {isCreatingPlaylist && (
          <form onSubmit={handleCreateSubmit} className="playlist-action-bar">
            <span className="action-bar-label">Nova Playlist:</span>
            <input
              type="text"
              autoFocus
              placeholder="Nome da playlist (ex: Gospel, Rock, Estudo)..."
              value={playlistNameInput}
              onChange={(e) => setPlaylistNameInput(e.target.value)}
              className="playlist-bar-input"
            />
            <button
              type="submit"
              className="confirm-btn primary"
              disabled={!playlistNameInput.trim()}
            >
              Criar
            </button>
            <button
              type="button"
              className="confirm-btn"
              onClick={() => setIsCreatingPlaylist(false)}
            >
              Cancelar
            </button>
          </form>
        )}

        {/* Modal / Formulário de Renomear Playlist */}
        {isRenamingPlaylist && (
          <form onSubmit={handleRenameSubmit} className="playlist-action-bar">
            <span className="action-bar-label">Renomear:</span>
            <input
              type="text"
              autoFocus
              value={playlistNameInput}
              onChange={(e) => setPlaylistNameInput(e.target.value)}
              className="playlist-bar-input"
            />
            <button
              type="submit"
              className="confirm-btn primary"
              disabled={!playlistNameInput.trim()}
            >
              Salvar
            </button>
            <button
              type="button"
              className="confirm-btn"
              onClick={() => setIsRenamingPlaylist(false)}
            >
              Cancelar
            </button>
          </form>
        )}

        {/* Menu Dropdown de Todas as Playlists */}
        {isPlaylistMenuOpen && (
          <div className="playlist-dropdown-panel">
            <div className="dropdown-panel-header">
              <span>Suas Playlists ({playlists.length})</span>
              <button
                className="dropdown-new-btn"
                onClick={() => {
                  setPlaylistNameInput('');
                  setIsCreatingPlaylist(true);
                  setIsPlaylistMenuOpen(false);
                }}
              >
                <Plus size={11} /> Nova Playlist
              </button>
            </div>

            <div className="dropdown-playlist-list">
              {playlists.map((pl) => {
                const isActive = pl.id === activePlaylistId;
                return (
                  <div
                    key={pl.id}
                    className={`dropdown-playlist-card ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onSwitchPlaylist(pl.id, false);
                      setIsPlaylistMenuOpen(false);
                    }}
                  >
                    <div className="card-info">
                      <div className="card-title-row">
                        <span className="card-name">{pl.name}</span>
                        {isActive && <span className="card-tag-active">▶ Tocando</span>}
                      </div>
                      <span className="card-count">{pl.items.length} vídeos</span>
                    </div>

                    <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="card-play-btn"
                        title="Tocar esta playlist agora"
                        onClick={() => {
                          onSwitchPlaylist(pl.id, true);
                          setIsPlaylistMenuOpen(false);
                        }}
                      >
                        <Play size={10} fill="currentColor" /> Tocar
                      </button>

                      {playlists.length > 1 && (
                        <>
                          {showDeleteConfirm ? (
                            <button
                              className="card-del-btn danger"
                              onClick={() => {
                                onDeletePlaylist(pl.id);
                                setShowDeleteConfirm(false);
                              }}
                            >
                              Confirmar?
                            </button>
                          ) : (
                            <button
                              className="card-del-btn"
                              title="Excluir playlist"
                              onClick={() => setShowDeleteConfirm(true)}
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Formulário rápido de adição dentro da playlist atual */}
        <form onSubmit={handleAddSubmit} className="queue-quick-input">
          <input
            type="text"
            placeholder="Colar link de vídeo ou playlist do YouTube..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="queue-input-field"
          />
          <button type="submit" className="queue-add-submit" disabled={!newUrl.trim()}>
            <Plus size={14} />
          </button>
        </form>

        {/* Lista de Vídeos da Playlist Atual */}
        <div className="queue-list-scroll">
          {queue.length === 0 ? (
            <div className="queue-empty">
              <span>Playlist vazia</span>
              <small>Cole um link de vídeo ou playlist acima</small>
            </div>
          ) : (
            queue.map((item, index) => {
              const isCurrent = index === currentIndex;
              return (
                <div
                  key={`${item.id}-${item.addedAt}-${index}`}
                  className={`queue-item-card ${isCurrent ? 'active' : ''}`}
                >
                  {/* Thumbnail e Badge */}
                  <div
                    className="queue-thumb-wrapper"
                    onClick={() => onPlayItem(index)}
                    title="Clique para reproduzir este vídeo"
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="queue-thumb-img"
                      loading="lazy"
                    />
                    {isCurrent && (
                      <div className="current-playing-badge">
                        <Play size={10} fill="currentColor" />
                      </div>
                    )}
                  </div>

                  {/* Informações */}
                  <div
                    className="queue-item-info"
                    onClick={() => onPlayItem(index)}
                    title={item.title}
                  >
                    <span className="queue-item-title">{item.title}</span>
                    <div className="queue-item-status-row">
                      {item.status === 'playing' && (
                        <span className="status-tag tag-playing">
                          <Play size={10} /> Em reprodução
                        </span>
                      )}
                      {item.status === 'played' && (
                        <span className="status-tag tag-played">
                          <CheckCircle2 size={10} /> Concluído
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <span className="status-tag tag-pending">
                          <Clock size={10} /> Aguardando
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="status-tag tag-error">
                          <AlertCircle size={10} /> Indisponível
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações de Copiar Link, Reordenação e Remoção */}
                  <div className="queue-item-actions" onMouseDown={(e) => e.stopPropagation()}>
                    <button
                      className={`copy-link-btn ${copiedId === item.id ? 'copied' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyLink(item.url, item.id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title={copiedId === item.id ? 'Link copiado!' : 'Copiar link do vídeo'}
                    >
                      {copiedId === item.id ? (
                        <Check size={12} className="text-success" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                    <button
                      className="reorder-btn"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorder(index, index - 1);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="Mover para cima"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      className="reorder-btn"
                      disabled={index === queue.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onReorder(index, index + 1);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="Mover para baixo"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      className="remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(index);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="Remover vídeo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
