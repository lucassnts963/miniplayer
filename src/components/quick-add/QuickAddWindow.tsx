import React, { useState, useEffect, useRef } from 'react';
import { Plus, Play, X, Check } from 'lucide-react';
import { YoutubeIcon } from '../ui/Icons';
import { parseYouTubeUrl } from '../../utils/youtube-url';
import { nativeService } from '../../services/native.service';

export const QuickAddWindow: React.FC = () => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Foco automático e leitura opcional do clipboard
  useEffect(() => {
    inputRef.current?.focus();

    // Tentar preencher com URL do YouTube da área de transferência se houver
    navigator.clipboard?.readText().then((clipText) => {
      if (clipText) {
        const parsed = parseYouTubeUrl(clipText.trim());
        if (parsed.isValid) {
          setUrl(clipText.trim());
        }
      }
    }).catch(() => {});
  }, []);

  const handleClose = async () => {
    setUrl('');
    setError(null);
    setSuccess(null);
    await nativeService.closeQuickAdd();
  };

  const handleAdd = async (playNow: boolean) => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Cole ou digite um link do YouTube');
      return;
    }

    const parsed = parseYouTubeUrl(trimmed);
    if (!parsed.isValid) {
      setError('Link do YouTube inválido');
      return;
    }

    setError(null);
    // Emite o evento nativo para a janela principal
    await nativeService.emitQuickAdd({
      url: parsed.canonicalUrl,
      playNow,
    });

    setSuccess(
      playNow
        ? 'Iniciando reprodução...'
        : parsed.isPlaylist
        ? 'Playlist adicionada à fila!'
        : 'Vídeo adicionado à fila!'
    );
    setUrl('');

    // Fecha a janela rápida após 600ms para permitir que o usuário retorne ao seu trabalho
    setTimeout(async () => {
      await handleClose();
    }, 600);
  };

  // Teclas Enter e Esc
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handleAdd(true); // Shift+Enter: Adicionar e reproduzir agora
      } else {
        handleAdd(false); // Enter: Adicionar à fila
      }
    }
  };

  return (
    <div className="quick-add-container" onKeyDown={handleKeyDown}>
      {/* Header com Drag Region */}
      <div
        className="quick-add-header"
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.button === 0 && !(e.target as HTMLElement).closest('button, input')) {
            nativeService.startDragging();
          }
        }}
      >
        <div
          className="quick-add-title"
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.button === 0) {
              nativeService.startDragging();
            }
          }}
        >
          <YoutubeIcon size={15} className="text-red" />
          <span>Adição Rápida de Vídeo</span>
        </div>
        <button
          className="icon-btn mini close"
          title="Fechar (Esc)"
          onClick={handleClose}
        >
          <X size={13} />
        </button>
      </div>

      <div className="quick-add-body">
        <input
          ref={inputRef}
          type="text"
          placeholder="Cole URL de vídeo ou playlist (Enter: fila, Shift+Enter: reproduzir)..."
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          className="quick-add-input"
        />

        {error && <div className="quick-add-feedback error">{error}</div>}
        {success && (
          <div className="quick-add-feedback success">
            <Check size={13} />
            <span>{success}</span>
          </div>
        )}

        <div className="quick-add-buttons">
          <button
            type="button"
            className="quick-btn secondary"
            onClick={() => handleAdd(false)}
            disabled={!url.trim()}
            title="Adicionar ao final da fila (Enter)"
          >
            <Plus size={14} />
            <span>Adicionar à Fila</span>
          </button>

          <button
            type="button"
            className="quick-btn primary"
            onClick={() => handleAdd(true)}
            disabled={!url.trim()}
            title="Adicionar e iniciar imediatamente (Shift+Enter)"
          >
            <Play size={14} fill="currentColor" />
            <span>Reproduzir Agora</span>
          </button>
        </div>
      </div>
    </div>
  );
};
