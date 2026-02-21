import { useState, useCallback } from 'react';

/**
 * Hook que gere animação de entrada e saída de modais.
 * Chame `close()` no lugar de `onClose()` dentro do modal.
 * O hook adiciona um delay de 200ms antes de chamar o `onClose` real,
 * para a animação CSS de saída terminar.
 */
export function useModalAnimation(onClose: () => void) {
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 200);
  }, [closing, onClose]);

  return { closing, close };
}
