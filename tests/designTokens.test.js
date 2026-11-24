import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('AIRINDX design tokens & security hygiene', () => {
  it('defines all required brand colors and font families in tokens.css', () => {
    const tokens = fs.readFileSync(path.resolve('src/styles/tokens.css'), 'utf8');
    expect(tokens).toContain('#123c32');
    expect(tokens).toContain('#237a5b');
    expect(tokens).toContain('#b9ed73');
    expect(tokens).toContain('#f5f7f2');
    expect(tokens).toContain('#ffffff');
    expect(tokens).toContain('Space Grotesk');
    expect(tokens).toContain('Inter');
    expect(tokens).toContain('JetBrains Mono');
  });

  it('does not include Tailwind CDN, Three.js CDN, Google Fonts CDN, or dummy credentials in index.html', () => {
    const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
    expect(indexHtml).toContain('http-equiv="Content-Security-Policy"');
    expect(indexHtml).toContain("script-src 'self'");
    expect(indexHtml).not.toContain('cdn.tailwindcss.com');
    expect(indexHtml).not.toContain('ajax.googleapis.com/ajax/libs/threejs');
    expect(indexHtml).not.toContain('fonts.googleapis.com');
    expect(indexHtml).not.toContain('ax_live_7721a9');
    expect(indexHtml).not.toContain('api.airindx.io');
  });
});
