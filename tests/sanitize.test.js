import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeUserInput, createSafeElement } from '../src/utils/sanitize.js';

describe('sanitize utilities', () => {
  it('escapes HTML special characters to prevent XSS', () => {
    const payload = '<img src=x onerror="alert(1)"> & `script`';
    expect(escapeHtml(payload)).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#96;script&#96;'
    );
  });

  it('bounds and strips control characters from user input', () => {
    const dirty = '  hello\u0000world\u0007  ';
    expect(sanitizeUserInput(dirty, 20)).toBe('hello world');
    expect(sanitizeUserInput('a'.repeat(600), 100).length).toBe(100);
  });

  it('blocks inline on* attributes in createSafeElement', () => {
    const el = createSafeElement('button', {
      text: 'Click',
      attrs: { onclick: 'evil()', type: 'button' },
    });
    expect(el.textContent).toBe('Click');
    expect(el.getAttribute('onclick')).toBeNull();
    expect(el.getAttribute('type')).toBe('button');
  });
});
