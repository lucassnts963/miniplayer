import { VideoMetadata } from '../types/player.types';
import { getYouTubeThumbnailUrl, parseYouTubeUrl } from '../utils/youtube-url';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let iframeApiLoadingPromise: Promise<void> | null = null;

/**
 * Carrega o script da YouTube Iframe Player API apenas uma vez de forma segura
 */
export function loadYouTubeIFrameAPI(): Promise<void> {
  if (typeof window !== 'undefined' && window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  if (iframeApiLoadingPromise) {
    return iframeApiLoadingPromise;
  }

  iframeApiLoadingPromise = new Promise<void>((resolve) => {
    // Verificar se a tag já foi inserida
    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const previousOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousOnReady) previousOnReady();
      resolve();
    };

    // Caso o script já tenha carregado antes do hook
    if (window.YT && window.YT.Player) {
      resolve();
    }
  });

  return iframeApiLoadingPromise;
}

/**
 * Busca metadados do vídeo (título e autor) usando a API oEmbed do YouTube sem precisar de chave de API.
 */
export async function fetchVideoMetadata(inputUrlOrId: string): Promise<VideoMetadata | null> {
  const parsed = parseYouTubeUrl(inputUrlOrId);
  if (!parsed.isValid || !parsed.videoId) {
    return null;
  }

  const videoId = parsed.videoId;
  const canonicalUrl = parsed.canonicalUrl;
  const fallbackThumbnail = getYouTubeThumbnailUrl(videoId, 'hq');

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        id: videoId,
        url: canonicalUrl,
        title: data.title || `Vídeo do YouTube (${videoId})`,
        author: data.author_name,
        thumbnail: data.thumbnail_url || fallbackThumbnail,
      };
    }
  } catch {
    // Em caso de falha de rede ou timeout, usamos metadados padrão
  }

  return {
    id: videoId,
    url: canonicalUrl,
    title: `Vídeo (${videoId})`,
    thumbnail: fallbackThumbnail,
  };
}
