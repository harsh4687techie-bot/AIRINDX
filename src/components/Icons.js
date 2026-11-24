/**
 * Zero-Dependency Inline SVG Icon Library
 * Ensures crisp icons in 100% offline demonstration mode with zero third-party
 * font/icon CDN requests and full screen-reader aria-hidden compliance.
 */

const ICON_PATHS = {
  auto_awesome: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3zm6.5 11l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1 1-2.4zM5.5 15l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8.8-1.9z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M6 6l12 12M18 6l-12 12"/>',
  chevron_right: '<path d="M9 6l6 6-6 6"/>',
  location_on: '<path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
  explore: '<circle cx="12" cy="12" r="9"/><polygon points="10,10 15.5,8.5 14,14 8.5,15.5"/>',
  travel_explore: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M4 11h14M11 4a10 10 0 0 1 0 14"/>',
  health_and_safety: '<path d="M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z"/><path d="M12 8v6M9 11h6"/>',
  thermostat: '<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
  humidity_percentage: '<path d="M12 3s6 6.4 6 10.5a6 6 0 1 1-12 0C6 9.4 12 3 12 3z"/>',
  air: '<path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5M3 12h15a2.5 2.5 0 1 1-2.5 2.5M3 16h8a2 2 0 1 1-2 2"/>',
  wb_sunny: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  compress: '<path d="M4 9h16M4 15h16M12 3v4M12 17v4M9 5l3 2 3-2M9 19l3-2 3 2"/>',
  visibility: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.5"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4M4 19h16"/>',
  arrow_forward: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrow_upward: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  public: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  blur_on: '<circle cx="8" cy="8" r="1.5"/><circle cx="16" cy="8" r="1.5"/><circle cx="8" cy="16" r="1.5"/><circle cx="16" cy="16" r="1.5"/><circle cx="12" cy="12" r="2"/>',
  sensors: '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9.5 9.5 0 0 0 0 13M18.5 5.5a9.5 9.5 0 0 1 0 13"/>',
  layers: '<polygon points="12,3 3,8 12,13 21,8"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/>',
  psychology_alt: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3z"/>',
  delete_sweep: '<path d="M4 7h12M9 7V4h2v3M6 7l1 13h6l1-13M16 11h5M16 15h4"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  content_copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  wifi_tethering_off: '<circle cx="12" cy="12" r="2"/><path d="M4 4l16 16M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 1.3 5.5"/>',
};

export function renderIcon(name, className = 'w-4 h-4') {
  const path = ICON_PATHS[name] || ICON_PATHS.air;
  return `<svg class="inline-block shrink-0 ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
