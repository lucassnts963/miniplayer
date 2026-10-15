import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  X,
  Check,
  ExternalLink,
  Globe,
  KeyRound,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { nativeService, AuthStatusResponse } from '../../services/native.service';

interface SavedSession {
  source: string;
  count: number;
  timestamp: number;
}

const STORAGE_KEY_AUTH = 'miniplayer_auth_session';

export const AuthWindow: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);

  const refreshAuthStatus = useCallback(async () => {
    try {
      const res = await nativeService.checkYouTubeAuth();
      setAuthStatus(res);
    } catch {
      // ignore
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTH);
      if (saved) {
        setSavedSession(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshAuthStatus();
  }, [refreshAuthStatus]);

  // Escuta evento de cookies importados
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    nativeService.onCookiesImported((payload) => {
      const info: SavedSession = {
        source: payload.source,
        count: payload.count,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(info));
      } catch {
        // ignore
      }
      setSavedSession(info);
      refreshAuthStatus();
    }).then((u) => {
      unlisten = u;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [refreshAuthStatus]);

  // Fechar com Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        nativeService.closeAuthWindow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleImport = async (browser?: 'firefox' | 'chrome' | 'edge') => {
    setIsImporting(true);
    setStatusType('info');
    setStatusMessage(
      browser === 'firefox'
        ? 'Sincronizando sessão do Firefox...'
        : 'Detectando navegadores instalados...'
    );

    try {
      const msg = await nativeService.importBrowserCookies(browser);
      setStatusType('success');
      setStatusMessage(`✓ ${msg}`);

      const chosenSource = browser
        ? browser.charAt(0).toUpperCase() + browser.slice(1)
        : 'Navegador';
      const info: SavedSession = {
        source: chosenSource,
        count: 0,
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(info));
      } catch {
        // ignore
      }
      setSavedSession(info);
      await refreshAuthStatus();

      // Fecha a janela de autenticação após 1.5s
      setTimeout(() => {
        nativeService.closeAuthWindow();
      }, 1500);
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(err?.message || 'Falha ao importar cookies do navegador.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setStatusType('info');
    setStatusMessage('Abrindo janela de login oficial do Google...');
    await nativeService.openYoutubeLogin();
    setStatusMessage('Janela de login aberta. Conclua o login na janela e reimporte ou feche-a.');
    const info: SavedSession = {
      source: 'Google Login',
      count: 0,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(info));
    } catch {
      // ignore
    }
    setSavedSession(info);
  };

  const isLoggedIn = Boolean(authStatus?.is_logged_in || savedSession);
  const activeBrowser = authStatus?.active_browser || savedSession?.source;

  const firefoxInfo = authStatus?.detected_browsers.find((b) => b.browser.toLowerCase() === 'firefox');
  const chromeInfo = authStatus?.detected_browsers.find((b) => b.browser.toLowerCase() === 'chrome');
  const edgeInfo = authStatus?.detected_browsers.find((b) => b.browser.toLowerCase() === 'edge');
  const chromiumHasSession = Boolean(chromeInfo?.has_session || edgeInfo?.has_session);

  return (
    <div className="auth-window-root">
      {/* Barra de Título Superior Arrastável */}
      <div
        className="auth-window-header"
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.button === 0 && !(e.target as HTMLElement).closest('button')) {
            nativeService.startDragging();
          }
        }}
      >
        <div
          className="auth-window-title"
          data-tauri-drag-region
          onMouseDown={(e) => {
            if (e.button === 0) {
              nativeService.startDragging();
            }
          }}
        >
          <ShieldCheck size={16} className="text-accent" />
          <span>Sessão & Login do YouTube</span>
        </div>
        <button
          className="icon-btn mini close"
          title="Fechar (Esc)"
          onClick={() => nativeService.closeAuthWindow()}
        >
          <X size={14} />
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div className="auth-window-body">
        {/* Indicador de Status de Login */}
        <div className={`auth-status-banner ${isLoggedIn ? 'logged-in' : 'not-logged-in'}`}>
          <div className="auth-status-left">
            <div className="auth-status-icon-wrap">
              {isLoggedIn ? (
                <CheckCircle2 size={24} className="text-success" />
              ) : (
                <AlertCircle size={24} className="text-warning" />
              )}
            </div>
            <div className="auth-status-info">
              <div className="auth-status-headline">
                <span className={`badge-live-dot ${isLoggedIn ? '' : 'warn'}`} />
                <span>{isLoggedIn ? 'Login Identificado / Sessão Ativa' : 'Nenhuma Sessão Identificada'}</span>
              </div>
              <p className="auth-status-subtext">
                {isLoggedIn
                  ? `Conta conectada no YouTube${activeBrowser ? ` via ${activeBrowser}` : ''}. Vídeos com restrição liberados.`
                  : 'Conecte sua conta para desbloquear vídeos protegidos e lives restritas.'}
              </p>
            </div>
          </div>

          {/* Botão de Refazer Login / Reimportar Cookies */}
          {isLoggedIn && (
            <button
              className="reauth-btn"
              title="Refazer importação de cookies para atualizar a sessão"
              onClick={() => handleImport(firefoxInfo?.has_session ? 'firefox' : undefined)}
              disabled={isImporting}
            >
              <RefreshCw size={12} className={isImporting ? 'spinner mini' : ''} />
              <span>Refazer Login</span>
            </button>
          )}
        </div>

        <p className="auth-window-desc">
          Você pode reimportar cookies a qualquer momento ou refazer o login caso a sessão expire:
        </p>

        <div className="auth-cards-group">
          {/* Card 1: Firefox */}
          <div
            className="auth-card-item primary"
            onClick={() => !isImporting && handleImport('firefox')}
          >
            <div className="auth-card-badge">Recomendado</div>
            <div className="auth-card-icon">🦊</div>
            <div className="auth-card-text">
              <div className="auth-card-name">Aproveitar Sessão do Firefox</div>
              <div className="auth-card-detail">
                Importa automaticamente sua conta ativa do Firefox em 1 clique sem redigitar senha.
              </div>
              {firefoxInfo?.has_session && (
                <div className="browser-session-tag">
                  <Check size={10} /> Sessão ativa identificada no Firefox
                </div>
              )}
            </div>
            <button
              className="auth-card-action-btn primary"
              disabled={isImporting}
            >
              {isLoggedIn && activeBrowser?.toLowerCase().includes('firefox') ? 'Reimportar' : 'Importar'}
            </button>
          </div>

          {/* Card 2: Chrome / Edge */}
          <div
            className="auth-card-item"
            onClick={() => !isImporting && handleImport()}
          >
            <div className="auth-card-icon">
              <Globe size={22} className="text-blue" />
            </div>
            <div className="auth-card-text">
              <div className="auth-card-name">Detectar Chrome ou Edge</div>
              <div className="auth-card-detail">
                Tenta transferir a sessão dos navegadores Chromium instalados no sistema.
              </div>
              {chromiumHasSession && (
                <div className="browser-session-tag">
                  <Check size={10} /> Sessão identificada no {chromeInfo?.has_session ? 'Chrome' : 'Edge'}
                </div>
              )}
            </div>
            <button
              className="auth-card-action-btn"
              disabled={isImporting}
            >
              {isLoggedIn ? 'Reimportar' : 'Detectar'}
            </button>
          </div>

          {/* Card 3: Google Login Nativo */}
          <div
            className="auth-card-item"
            onClick={() => !isImporting && handleGoogleLogin()}
          >
            <div className="auth-card-icon">
              <KeyRound size={22} className="text-yellow" />
            </div>
            <div className="auth-card-text">
              <div className="auth-card-name">Login Direto no YouTube (Google)</div>
              <div className="auth-card-detail">
                Abre a janela oficial do Google (580x780) para você entrar ou trocar de conta.
              </div>
            </div>
            <button
              className="auth-card-action-btn"
              disabled={isImporting}
            >
              <ExternalLink size={13} /> {isLoggedIn ? 'Refazer Login' : 'Entrar'}
            </button>
          </div>
        </div>

        {/* Feedback de Status */}
        {statusMessage && (
          <div className={`auth-window-status ${statusType}`}>
            {isImporting && <span className="spinner mini" />}
            {statusType === 'success' && <Check size={14} className="text-success" />}
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};

