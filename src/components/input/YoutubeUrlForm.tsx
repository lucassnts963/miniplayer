import React, { useState } from 'react';
import { Play, X, Minus, Keyboard, User } from 'lucide-react';
import { YoutubeIcon } from '../ui/Icons';
import { parseYouTubeUrl } from '../../utils/youtube-url';
import { nativeService } from '../../services/native.service';

interface YoutubeUrlFormProps {
  onSubmit: (url: string) => Promise<any>;
  onClose: () => void;
}

export const YoutubeUrlForm: React.FC<YoutubeUrlFormProps> = ({ onSubmit, onClose }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMessage('Por favor, insira um link do YouTube');
      return;
    }

    const parsed = parseYouTubeUrl(trimmed);
    if (!parsed.isValid) {
      setErrorMessage('Link inválido. Insira uma URL de vídeo, shorts, live ou playlist do YouTube.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await onSubmit(trimmed);
      if (res && res.success === false) {
        setErrorMessage(res.message);
      }
    } catch {
      setErrorMessage('Erro ao carregar o vídeo. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      }
    } catch {
      // Falha permissão clipboard
    }
  };

  return (
    <div className="initial-form-container">
      {/* Barra de Título Minimalista com Área de Arraste */}
      <div
        className="form-header"
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.button === 0 && !(e.target as HTMLElement).closest('button, input')) {
            nativeService.startDragging();
          }
        }}
      >
        <div
          className="brand"
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.button === 0) {
              nativeService.startDragging();
            }
          }}
        >
          <YoutubeIcon size={18} className="brand-icon" />
          <span className="brand-text">Mini Player YouTube</span>
        </div>

        <div className="window-actions">
          <button
            type="button"
            className="icon-btn mini"
            title="Conectar Conta YouTube / Aproveitar Login do Firefox ou Chrome"
            onClick={() => nativeService.openAuthWindow()}
          >
            <User size={13} />
          </button>
          <button
            className="icon-btn mini"
            title="Minimizar"
            onClick={() => nativeService.minimizePlayer()}
          >
            <Minus size={13} />
          </button>
          <button
            className="icon-btn mini close"
            title="Fechar aplicativo"
            onClick={onClose}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Conteúdo Central */}
      <div className="form-body">
        <form onSubmit={handleSubmit} className="form-content">
          <div className="input-group">
            <input
              type="text"
              autoFocus
              placeholder="Cole a URL do YouTube (vídeo, playlist, shorts)..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="url-input"
              disabled={isLoading}
            />
            {!url && (
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="paste-badge"
                title="Colar da área de transferência"
              >
                Colar
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="form-error-banner">
              {errorMessage}
            </div>
          )}

          <div className="form-actions-row">
            <button
              type="submit"
              className="play-primary-btn"
              disabled={isLoading || !url.trim()}
            >
              {isLoading ? (
                <span className="spinner" />
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  <span>Reproduzir</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Guia Rápido de Atalhos */}
        <div className="shortcuts-hint">
          <div className="shortcuts-title">
            <Keyboard size={13} />
            <span>Atalhos Globais do Windows</span>
          </div>
          <div className="shortcuts-grid">
            <div className="shortcut-item">
              <kbd>Ctrl+Shift+Space</kbd>
              <span>Mostrar/Ocultar</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl+Shift+A</kbd>
              <span>Adição Rápida</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl+Shift+►/◄</kbd>
              <span>Próximo/Anterior</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl+Shift+T</kbd>
              <span>Always on Top</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
