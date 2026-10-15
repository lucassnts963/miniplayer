import React, { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  durationMs?: number;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, durationMs = 2200, onDismiss }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div className="toast-notification">
      <span>{message}</span>
    </div>
  );
};
