/**
 * Container-Scoped Cleanup Registry
 * Guarantees previous WebGL renderers, animation loops, and listeners are
 * disposed before a container re-renders internally or unmounts.
 */

const cleanupMap = new WeakMap();

export function runContainerCleanup(container) {
  if (!container) return;
  const prev = cleanupMap.get(container);
  if (typeof prev === 'function') {
    cleanupMap.delete(container);
    prev();
  }
}

export function registerContainerCleanup(container, cleanupFn) {
  if (!container) return;
  runContainerCleanup(container);
  if (typeof cleanupFn === 'function') {
    cleanupMap.set(container, cleanupFn);
  }
}
