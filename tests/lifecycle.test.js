import { describe, it, expect, vi } from 'vitest';
import { registerContainerCleanup, runContainerCleanup } from '../src/utils/lifecycle.js';

describe('container lifecycle cleanup registry', () => {
  it('runs previous cleanup before registering a new cleanup or unmounting', () => {
    const el = document.createElement('div');
    const first = vi.fn();
    const second = vi.fn();

    registerContainerCleanup(el, first);
    expect(first).not.toHaveBeenCalled();

    registerContainerCleanup(el, second);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    runContainerCleanup(el);
    expect(second).toHaveBeenCalledTimes(1);

    // Subsequent cleanup is a no-op
    runContainerCleanup(el);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
