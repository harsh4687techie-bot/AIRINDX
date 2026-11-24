/**
 * Security utilities for safe DOM rendering and input validation.
 */

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

/**
 * Escapes untrusted strings before interpolation into HTML templates.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Normalizes and bounds user search or prompt input.
 * @param {unknown} input
 * @param {number} maxLength
 * @returns {string}
 */
export function sanitizeUserInput(input, maxLength = 500) {
  if (typeof input !== 'string') return '';
  let cleaned = '';
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    cleaned += code <= 31 || code === 127 ? ' ' : input[i];
  }
  return cleaned.trim().slice(0, maxLength);
}

/**
 * Creates a DOM element safely using textContent and explicit attributes.
 * @param {string} tag
 * @param {object} options
 * @returns {HTMLElement}
 */
export function createSafeElement(tag, { className = '', text = '', attrs = {} } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null && text !== '') {
    el.textContent = String(text);
  }
  for (const [key, val] of Object.entries(attrs)) {
    if (key.startsWith('on')) continue; // Block inline event attributes
    if (val !== undefined && val !== null) {
      el.setAttribute(key, String(val));
    }
  }
  return el;
}
