import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { QuickAddPayload, WindowPreset } from '../types/player.types';

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export const nativeService = {
  async toggleVisibility(): Promise<boolean> {
    if (!isTauriEnvironment()) return true;
    try {
      return await invoke<boolean>('toggle_player_visibility');
    } catch (e) {
      console.warn('Erro ao alternar visibilidade:', e);
      return true;
    }
  },

  async toggleAlwaysOnTop(): Promise<boolean> {
    if (!isTauriEnvironment()) return true;
    try {
      return await invoke<boolean>('toggle_always_on_top');
    } catch (e) {
      console.warn('Erro ao alternar always on top:', e);
      return true;
    }
  },

  async getAlwaysOnTop(): Promise<boolean> {
    if (!isTauriEnvironment()) return true;
    try {
      return await invoke<boolean>('get_always_on_top');
    } catch (e) {
      console.warn('Erro ao obter status de always on top:', e);
      return true;
    }
  },

  async toggleFullscreen(): Promise<boolean> {
    if (!isTauriEnvironment()) return false;
    try {
      return await invoke<boolean>('toggle_fullscreen');
    } catch {
      try {
        const appWindow = getCurrentWindow();
        const isFullscreen = await appWindow.isFullscreen();
        await appWindow.setFullscreen(!isFullscreen);
        return !isFullscreen;
      } catch (e) {
        console.warn('Erro ao alternar fullscreen:', e);
        return false;
      }
    }
  },

  async openQuickAdd(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('open_quick_add');
    } catch (e) {
      console.warn('Erro ao abrir janela rápida:', e);
    }
  },

  async closeQuickAdd(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('close_quick_add');
    } catch (e) {
      console.warn('Erro ao fechar janela rápida:', e);
    }
  },

  async setWindowPreset(preset: WindowPreset): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('set_window_preset', { preset });
    } catch (e) {
      console.warn('Erro ao redimensionar janela:', e);
    }
  },

  async positionBottomRight(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('position_bottom_right');
    } catch (e) {
      console.warn('Erro ao posicionar janela:', e);
    }
  },

  async minimizePlayer(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('minimize_player');
    } catch (e) {
      console.warn('Erro ao minimizar player:', e);
    }
  },

  async closeApp(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('close_app');
    } catch (e) {
      console.warn('Erro ao fechar app:', e);
    }
  },

  async startDragging(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('start_window_dragging');
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.startDragging();
      } catch (e) {
        console.warn('Erro ao arrastar janela:', e);
      }
    }
  },

  async setWindowPositionOffset(dx: number, dy: number): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('set_window_position_offset', { dx: Math.round(dx), dy: Math.round(dy) });
    } catch (e) {
      console.warn('Erro ao mover janela via offset:', e);
    }
  },

  async importBrowserCookies(browser?: 'firefox' | 'chrome' | 'edge'): Promise<string> {
    if (!isTauriEnvironment()) return 'Ambiente Web - Cookies simulados';
    try {
      return await invoke<string>('import_browser_cookies', { browser: browser || null });
    } catch (e: any) {
      console.warn('Erro ao importar cookies do navegador:', e);
      throw new Error(typeof e === 'string' ? e : e?.message || 'Falha ao importar cookies');
    }
  },

  async openAuthWindow(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('open_auth_window');
    } catch (e) {
      console.warn('Erro ao abrir janela de autenticação:', e);
    }
  },

  async closeAuthWindow(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('close_auth_window');
    } catch (e) {
      console.warn('Erro ao fechar janela de autenticação:', e);
    }
  },

  async openYoutubeLogin(): Promise<void> {
    if (!isTauriEnvironment()) return;
    try {
      await invoke('open_youtube_login');
    } catch (e) {
      console.warn('Erro ao abrir tela de login do YouTube:', e);
    }
  },

  async onCookiesImported(
    callback: (payload: { count: number; source: string; message: string }) => void
  ): Promise<() => void> {
    if (!isTauriEnvironment()) return () => {};
    const unlisten = await listen<{ count: number; source: string; message: string }>(
      'cookies-imported',
      (event) => {
        callback(event.payload);
      }
    );
    return unlisten;
  },

  // Eventos de comunicação
  async onShortcutNext(callback: () => void): Promise<() => void> {
    if (!isTauriEnvironment()) return () => {};
    const unlisten = await listen('shortcut-next', () => callback());
    return unlisten;
  },

  async onShortcutPrevious(callback: () => void): Promise<() => void> {
    if (!isTauriEnvironment()) return () => {};
    const unlisten = await listen('shortcut-previous', () => callback());
    return unlisten;
  },

  async onQuickAddReceived(callback: (payload: QuickAddPayload) => void): Promise<() => void> {
    if (!isTauriEnvironment()) return () => {};
    const unlisten = await listen<QuickAddPayload>('quick-add-video', (event) => {
      callback(event.payload);
    });
    return unlisten;
  },

  async fetchYouTubePlaylist(playlistUrlOrId: string): Promise<PlaylistFetchResult> {
    if (!isTauriEnvironment()) {
      throw new Error('Ambiente de desenvolvimento web não suporta busca nativa de playlist');
    }
    return await invoke<PlaylistFetchResult>('fetch_youtube_playlist', { playlistUrlOrId });
  },

  async checkYouTubeAuth(): Promise<AuthStatusResponse> {
    if (!isTauriEnvironment()) {
      return { is_logged_in: false, active_browser: null, detected_browsers: [] };
    }
    try {
      return await invoke<AuthStatusResponse>('check_youtube_auth');
    } catch (e) {
      console.warn('Erro ao checar status de autenticação:', e);
      return { is_logged_in: false, active_browser: null, detected_browsers: [] };
    }
  },

  async emitQuickAdd(payload: QuickAddPayload): Promise<void> {
    if (!isTauriEnvironment()) return;
    await emit('quick-add-video', payload);
  },
};

export interface BrowserAuthInfo {
  browser: string;
  has_session: boolean;
  cookie_count: number;
}

export interface AuthStatusResponse {
  is_logged_in: boolean;
  active_browser: string | null;
  detected_browsers: BrowserAuthInfo[];
}

export interface PlaylistFetchItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
}

export interface PlaylistFetchResult {
  id: string;
  title?: string;
  items: PlaylistFetchItem[];
}

