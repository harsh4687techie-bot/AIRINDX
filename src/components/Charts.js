/**
 * Reusable Data-Driven SVG Chart Generators
 * Computes real SVG coordinates from actual series arrays (never static hardcoded paths).
 */

import { escapeHtml } from '../utils/sanitize.js';

export function buildSparklineSvg(values = [], strokeClass = 'text-secondary') {
  if (!Array.isArray(values) || values.length < 2) {
    return '<div class="h-10 flex items-center font-label-micro text-[10px] text-text-muted">Insufficient trend points</div>';
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 200;
  const height = 40;
  const padY = 5;

  const coords = values.map((v, idx) => {
    const x = (idx / (values.length - 1)) * width;
    const y = height - padY - ((v - min) / span) * (height - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePoints = coords.join(' ');
  const areaPoints = `${linePoints} ${width},${height} 0,${height}`;

  return `
    <svg class="w-full h-10 ${escapeHtml(strokeClass)}" preserveAspectRatio="none" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <polygon points="${areaPoints}" fill="currentColor" fill-opacity="0.12"></polygon>
      <polyline points="${linePoints}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
  `;
}

/**
 * Generates an interactive-ready SVG time-series chart with exact coordinates returned
 * so hover scrubbers align 1:1 with actual plotted data points.
 */
export function buildLineSeriesChart({
  series = [],
  height = 300,
  width = 960,
  unitLabel = 'AQI',
  showWindOverlay = false,
  thresholds = [
    { value: 50, label: '50 Good', color: '#237A5B' },
    { value: 100, label: '100 Moderate/Satisfactory', color: '#F2C94C' },
    { value: 200, label: '200 Poor/Unhealthy', color: '#F2994A' },
    { value: 300, label: '300 Very Poor', color: '#EB5757' },
  ],
} = {}) {
  const valid = series.filter((pt) => typeof pt.value === 'number');
  if (valid.length < 2) {
    return {
      html: '<div class="p-8 text-center font-label-micro text-xs text-text-muted">Insufficient historical data points to render chart.</div>',
      plottedPoints: [],
    };
  }

  const padLeft = 56;
  const padRight = 24;
  const padTop = 26;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxData = Math.max(...valid.map((p) => p.value));
  const yMax = Math.max(maxData * 1.15, thresholds.length ? 220 : maxData * 1.2, 50);

  const toX = (i) => padLeft + (i / (valid.length - 1)) * chartW;
  const toY = (val) => padTop + chartH - (Math.max(0, val) / yMax) * chartH;

  const plottedPoints = valid.map((pt, idx) => ({
    ...pt,
    cx: Number(toX(idx).toFixed(1)),
    cy: Number(toY(pt.value).toFixed(1)),
  }));

  const pathD = plottedPoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.cx},${pt.cy}`)
    .join(' ');
  const areaD = `${pathD} L${plottedPoints[plottedPoints.length - 1].cx},${padTop + chartH} L${plottedPoints[0].cx},${padTop + chartH} Z`;

  let windPathHtml = '';
  if (showWindOverlay) {
    const maxWind = Math.max(...valid.map((p) => p.windSpeedKmh || 0), 25);
    const windD = valid
      .map((pt, idx) => {
        const wx = toX(idx).toFixed(1);
        const wy = (padTop + chartH - ((pt.windSpeedKmh || 0) / maxWind) * (chartH * 0.65)).toFixed(1);
        return `${idx === 0 ? 'M' : 'L'}${wx},${wy}`;
      })
      .join(' ');
    windPathHtml = `<path d="${windD}" fill="none" stroke="#237A5B" stroke-dasharray="5 5" stroke-width="2" opacity="0.75"></path>`;
  }

  const thresholdLines = thresholds
    .filter((t) => t.value <= yMax)
    .map((t) => {
      const y = toY(t.value).toFixed(1);
      return `
        <line x1="${padLeft}" x2="${width - padRight}" y1="${y}" y2="${y}" stroke="${t.color}" stroke-opacity="0.35" stroke-dasharray="4 4" stroke-width="1.2"></line>
        <text x="${padLeft - 8}" y="${Number(y) + 4}" text-anchor="end" fill="#55655D" font-family="JetBrains Mono" font-size="10">${escapeHtml(t.value)}</text>
      `;
    })
    .join('');

  const peakPt = plottedPoints.reduce((best, cur) => (cur.value > best.value ? cur : best), plottedPoints[0]);
  const minPt = plottedPoints.reduce((best, cur) => (cur.value < best.value ? cur : best), plottedPoints[0]);

  const xLabelStep = Math.max(1, Math.floor(plottedPoints.length / 6));
  const xLabels = plottedPoints
    .filter((_, idx) => idx === 0 || idx === plottedPoints.length - 1 || idx % xLabelStep === 0)
    .map(
      (pt) =>
        `<text x="${pt.cx}" y="${height - 8}" text-anchor="middle" fill="#55655D" font-family="JetBrains Mono" font-size="10">${escapeHtml(pt.label)}</text>`
    )
    .join('');

  const gradId = `grad_${Math.random().toString(36).slice(2, 8)}`;
  const titleId = `title_${gradId}`;
  const descId = `desc_${gradId}`;
  const summaryText = `${valid.length} data points in ${unitLabel}, minimum ${minPt.value} (${minPt.label}), peak ${peakPt.value} (${peakPt.label}).`;

  const html = `
    <svg class="w-full h-full overflow-visible" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${titleId} ${descId}">
      <title id="${titleId}">Time series chart in ${escapeHtml(unitLabel)}</title>
      <desc id="${descId}">${escapeHtml(summaryText)}</desc>
      <defs>
        <linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#123C32" stop-opacity="0.28"></stop>
          <stop offset="100%" stop-color="#B9ED73" stop-opacity="0.0"></stop>
        </linearGradient>
      </defs>
      ${thresholdLines}
      <line x1="${padLeft}" x2="${width - padRight}" y1="${padTop + chartH}" y2="${padTop + chartH}" stroke="#C0C8C4" stroke-width="1"></line>
      <path d="${areaD}" fill="url(#${gradId})"></path>
      ${windPathHtml}
      <path d="${pathD}" fill="none" stroke="#123C32" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="${peakPt.cx}" cy="${peakPt.cy}" r="5.5" fill="#EB5757" stroke="#FFFFFF" stroke-width="2"></circle>
      <circle cx="${minPt.cx}" cy="${minPt.cy}" r="5.5" fill="#B9ED73" stroke="#123C32" stroke-width="2"></circle>
      <line data-scrubber-line x1="0" x2="0" y1="${padTop}" y2="${padTop + chartH}" stroke="#123C32" stroke-dasharray="3 3" stroke-width="1.5" opacity="0"></line>
      <circle data-scrubber-dot cx="0" cy="0" r="5" fill="#B9ED73" stroke="#123C32" stroke-width="2" opacity="0"></circle>
      ${xLabels}
    </svg>
  `;

  return { html, plottedPoints, peakPt, minPt };
}
