/**
 * Shared AIRINDX Footer
 */

export function renderFooter() {
  return `
    <footer class="w-full bg-surface-white border-t border-border-subtle py-12 mt-12">
      <div class="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div class="space-y-3">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-aqi-good">
                <img src="/assets/airindx-mark.png" alt="AIRINDX Mark" class="w-5 h-5 rounded object-contain" />
              </div>
              <span class="font-headline-sm text-lg font-bold text-primary">AIRINDX</span>
            </div>
            <p class="font-body-sm text-xs text-text-muted leading-relaxed">
              Intelligent Air. Informed Living. Environmental intelligence platform for explainable air quality telemetry and atmospheric analysis.
            </p>
          </div>
          <div>
            <h2 class="font-title-card text-xs font-bold text-primary uppercase tracking-wider mb-3">Standards &amp; Benchmarks</h2>
            <ul class="space-y-2 font-body-sm text-xs text-text-muted">
              <li>WHO Air Quality Guidelines (2021)</li>
              <li>CPCB National Air Quality Index (NAQI)</li>
              <li>US EPA 40 CFR Part 58</li>
            </ul>
          </div>
          <div>
            <h2 class="font-title-card text-xs font-bold text-primary uppercase tracking-wider mb-3">Architecture</h2>
            <ul class="space-y-2 font-body-sm text-xs text-text-muted">
              <li>Vite + ES Modules + Tailwind CSS</li>
              <li>Local Three.js 3D Globe Engine</li>
              <li>FastAPI Integration Contract Ready</li>
            </ul>
          </div>
          <div>
            <h2 class="font-title-card text-xs font-bold text-primary uppercase tracking-wider mb-3">Data Provenance</h2>
            <ul class="space-y-2 font-body-sm text-xs text-text-muted">
              <li>Demonstration dataset clearly labeled</li>
              <li>Optional Copernicus CAMS AOD column feed</li>
              <li>No medical advice &bull; zero-secret client policy</li>
            </ul>
          </div>
        </div>
        <div class="pt-6 border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-label-micro text-text-muted">
          <span>AIRINDX Environmental Intelligence Platform</span>
          <span>Offline-First Release &bull; CPCB &amp; US EPA Compliant</span>
        </div>
      </div>
    </footer>
  `;
}
