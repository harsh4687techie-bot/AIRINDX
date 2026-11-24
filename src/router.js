/**
 * AIRINDX Hash-Based Client Router
 * Supports all seven application routes with async sequence guard and unmount cleanup.
 */

export const ROUTES = [
  '/',
  '/explore-map',
  '/pollutants',
  '/history',
  '/weather',
  '/ai-assistant',
  '/comparison',
];

export function normalizeRoute(hashValue) {
  const raw = String(hashValue || '').replace(/^#/, '').trim();
  if (!raw || raw === '') return '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return ROUTES.includes(path) ? path : '/';
}

export function createRouter({ routes, onRender }) {
  let cleanupCurrent = null;
  let renderSeq = 0;

  async function renderRoute() {
    const seq = ++renderSeq;
    const path = normalizeRoute(window.location.hash);
    if (typeof cleanupCurrent === 'function') {
      cleanupCurrent();
      cleanupCurrent = null;
    }

    const pageHandler = routes[path] || routes['/'];
    const maybeCleanup = await onRender(path, pageHandler, () => seq === renderSeq);
    if (seq !== renderSeq) {
      // Stale async render completed after a newer navigation: dispose immediately
      if (typeof maybeCleanup === 'function') maybeCleanup();
      return;
    }
    if (typeof maybeCleanup === 'function') {
      cleanupCurrent = maybeCleanup;
    }
  }

  function start() {
    window.addEventListener('hashchange', renderRoute);
    return renderRoute();
  }

  function destroy() {
    renderSeq++;
    window.removeEventListener('hashchange', renderRoute);
    if (typeof cleanupCurrent === 'function') {
      cleanupCurrent();
      cleanupCurrent = null;
    }
  }

  return { start, destroy, renderRoute };
}
