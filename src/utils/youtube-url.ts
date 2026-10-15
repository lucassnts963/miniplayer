/**
 * Utilitários para validação e extração de links do YouTube
 */

export interface ParsedYouTubeUrl {
  videoId: string | null;
  playlistId: string | null;
  isPlaylist: boolean;
  isValid: boolean;
  canonicalUrl: string;
}

/**
 * Expressão regular para validar e capturar IDs de vídeos ou playlists do YouTube
 * Cobre:
 * - youtube.com/watch?v=ID
 * - youtu.be/ID
 * - youtube.com/shorts/ID
 * - youtube.com/live/ID
 * - youtube.com/embed/ID
 * - youtube.com/playlist?list=ID
 * - youtube.com/watch?v=ID&list=PLAYLIST_ID
 * - IDs puros de vídeo (11 chars) ou playlist (PL..., RD..., etc.)
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeUrl {
  if (!input || typeof input !== 'string') {
    return { videoId: null, playlistId: null, isPlaylist: false, isValid: false, canonicalUrl: '' };
  }

  const trimmed = input.trim();

  // Teste para ID puro de playlist (inicia com PL, RD, UU, LL, OLAK e tem pelo menos 10 chars)
  if (/^(PL|RD|UU|LL|OLAK)[a-zA-Z0-9_-]{8,}$/.test(trimmed)) {
    return {
      videoId: null,
      playlistId: trimmed,
      isPlaylist: true,
      isValid: true,
      canonicalUrl: `https://www.youtube.com/playlist?list=${trimmed}`,
    };
  }

  // Teste para ID direto de vídeo de 11 caracteres (letras, números, _ ou -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return {
      videoId: trimmed,
      playlistId: null,
      isPlaylist: false,
      isValid: true,
      canonicalUrl: `https://www.youtube.com/watch?v=${trimmed}`,
    };
  }

  try {
    // Normalizar se não tiver protocolo
    const urlString = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

    const url = new URL(urlString);
    let videoId: string | null = null;
    let playlistId: string | null = url.searchParams.get('list');

    // 1. Caso youtu.be/VIDEO_ID
    if (url.hostname.includes('youtu.be')) {
      const pathSegments = url.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        videoId = pathSegments[0];
      }
    }
    // 2. Caso youtube.com (watch, shorts, live, embed, playlist, etc.)
    else if (url.hostname.includes('youtube.com') || url.hostname.includes('youtube-nocookie.com')) {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v');
      } else if (url.pathname.startsWith('/playlist')) {
        playlistId = url.searchParams.get('list');
      } else if (url.pathname.startsWith('/shorts/')) {
        videoId = url.pathname.replace('/shorts/', '').split('/')[0];
      } else if (url.pathname.startsWith('/live/')) {
        videoId = url.pathname.replace('/live/', '').split('/')[0];
      } else if (url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.replace('/embed/', '').split('/')[0];
      } else if (url.pathname.startsWith('/v/')) {
        videoId = url.pathname.replace('/v/', '').split('/')[0];
      }
    }

    // Limpar parâmetros extras que possam ter sobrado no ID
    if (videoId) {
      videoId = videoId.split('?')[0].split('&')[0];
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        videoId = null;
      }
    }

    if (playlistId) {
      playlistId = playlistId.split('&')[0];
    }

    const isPlaylist = Boolean(playlistId);
    const isValid = Boolean(videoId || playlistId);

    let canonicalUrl = '';
    if (playlistId) {
      if (videoId) {
        canonicalUrl = `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`;
      } else {
        canonicalUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
      }
    } else if (videoId) {
      canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }

    return {
      videoId,
      playlistId,
      isPlaylist,
      isValid,
      canonicalUrl,
    };
  } catch {
    return {
      videoId: null,
      playlistId: null,
      isPlaylist: false,
      isValid: false,
      canonicalUrl: '',
    };
  }
}

/**
 * Retorna a melhor URL de thumbnail para um ID do YouTube
 */
export function getYouTubeThumbnailUrl(videoId: string, quality: 'default' | 'mq' | 'hq' | 'maxres' = 'hq'): string {
  switch (quality) {
    case 'default':
      return `https://img.youtube.com/vi/${videoId}/default.jpg`;
    case 'mq':
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    case 'maxres':
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    case 'hq':
    default:
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }
}
