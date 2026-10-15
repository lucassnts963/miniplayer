import { useState, useEffect, useRef, useCallback } from 'react';

interface UseMouseVisibilityOptions {
  timeoutMs?: number;
  initialVisible?: boolean;
}

export function useMouseVisibility({
  timeoutMs = 1800,
  initialVisible = false,
}: UseMouseVisibilityOptions = {}) {
  const [isVisible, setIsVisible] = useState(initialVisible);
  const [isLocked, setIsLocked] = useState(false); // Quando interagindo diretamente com controles/sliders/painel
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    clearTimer();
    if (!isLocked) {
      timerRef.current = window.setTimeout(() => {
        setIsVisible(false);
      }, timeoutMs);
    }
  }, [clearTimer, isLocked, timeoutMs]);

  const onMouseMove = useCallback(() => {
    setIsVisible(true);
    resetTimer();
  }, [resetTimer]);

  const onMouseEnter = useCallback(() => {
    setIsVisible(true);
    resetTimer();
  }, [resetTimer]);

  const onMouseLeave = useCallback(() => {
    clearTimer();
    if (!isLocked) {
      setIsVisible(false);
    }
  }, [clearTimer, isLocked]);

  // Bloqueia os controles visíveis (ex: enquanto abre a fila ou menu)
  const lockVisibility = useCallback((locked: boolean) => {
    setIsLocked(locked);
    if (locked) {
      clearTimer();
      setIsVisible(true);
    } else {
      resetTimer();
    }
  }, [clearTimer, resetTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    isVisible: isVisible || isLocked,
    onMouseMove,
    onMouseEnter,
    onMouseLeave,
    lockVisibility,
  };
}
