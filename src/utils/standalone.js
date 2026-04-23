export function isStandalone() {
  if (typeof navigator !== 'undefined' && navigator.standalone === true) return true;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(display-mode: standalone)').matches;
  }
  return false;
}

export function isIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua);
}
