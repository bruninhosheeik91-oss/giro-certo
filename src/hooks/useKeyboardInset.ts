import { useEffect, useState } from 'react';

/**
 * Altura coberta pelo teclado do celular, em pixels.
 *
 * No WebView do Capacitor o `adjustResize` já reduz a viewport, mas no navegador
 * móvel o teclado cobre o conteúdo. Virar esse valor em padding deixa o
 * formulário rolar acima do teclado em vez de esconder o campo em foco.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      const hidden = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setInset(Math.round(hidden));
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
