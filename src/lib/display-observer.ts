/**
 * Display-aware observer.
 * Detects Mini-LED / OLED hardware via matchMedia and stamps
 * data-display-type="oled" | "lcd" on <html> so components can
 * read it via JS in addition to the pure-CSS media query path.
 *
 * The 0.3s bg transition in index.css handles the LCD→OLED
 * shift that occurs when dragging a window between monitors.
 */

const MQ = '(video-dynamic-range: high) and (color-gamut: p3)';

function applyDisplayType(isHighDynamic: boolean) {
  document.documentElement.setAttribute(
    'data-display-type',
    isHighDynamic ? 'oled' : 'lcd',
  );
}

export function initDisplayObserver(): () => void {
  const mq = window.matchMedia(MQ);
  applyDisplayType(mq.matches);

  const handler = (e: MediaQueryListEvent) => applyDisplayType(e.matches);
  mq.addEventListener('change', handler);

  // Return cleanup so callers can tear down (e.g. in React StrictMode double-invoke)
  return () => mq.removeEventListener('change', handler);
}
