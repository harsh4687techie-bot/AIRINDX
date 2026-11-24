import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PREVIEW_PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const AXE_SOURCE = fs.readFileSync(path.resolve('node_modules/axe-core/axe.min.js'), 'utf8');

const ROUTES = [
  { hash: '#/', name: 'Live Dashboard', expectedText: 'Mumbai, Maharashtra, India' },
  { hash: '#/explore-map', name: 'Explore Map', expectedText: 'Explore Global & Regional Air Quality Map' },
  { hash: '#/pollutants', name: 'Pollutants', expectedText: 'Pollutant Chemistry & AQI Sub-Index Analysis' },
  { hash: '#/history', name: 'Historical Analysis', expectedText: 'Historical Air Quality Analysis' },
  { hash: '#/weather', name: 'Weather', expectedText: 'Weather & Atmospheric Dispersion Dynamics' },
  { hash: '#/ai-assistant', name: 'AI Assistant', expectedText: 'AIRINDX Environmental AI Assistant' },
  { hash: '#/comparison', name: 'City Comparison', expectedText: 'Multi-City Air Quality Comparison' },
];

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'laptop-1366', width: 1366, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-375', width: 375, height: 812 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry until timeout
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for Vite preview server at ${url}`);
}

async function run() {
  const viteBin = path.resolve('node_modules/vite/bin/vite.js');
  const viteProc = spawn(
    process.execPath,
    [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let viteErr = '';
  viteProc.stderr.on('data', (chunk) => {
    viteErr += chunk.toString();
  });

  let browser;
  let fallbackBrowser;

  try {
    await waitForServer(BASE_URL);

    browser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    const consoleErrors = [];
    const runtimeExceptions = [];
    const failedRequests = [];
    const externalRequests = [];
    const cspViolations = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      runtimeExceptions.push(String(err));
    });
    page.on('requestfailed', (req) => {
      failedRequests.push({ url: req.url(), error: req.failure()?.errorText || 'failed' });
    });
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith(BASE_URL) && !url.startsWith('data:') && !url.startsWith('blob:')) {
        externalRequests.push(url);
      }
    });

    await page.route(`${BASE_URL}/__axe.min.js`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: AXE_SOURCE,
      })
    );

    await page.addInitScript(() => {
      window.__airindxCspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__airindxCspViolations.push({
          violatedDirective: e.violatedDirective,
          blockedURI: e.blockedURI,
        });
      });
    });

    const routeReports = [];
    const axeReports = [];

    // 1. Verify all 7 routes + axe-core WCAG 2.2 AA
    for (const r of ROUTES) {
      await page.goto(`${BASE_URL}/${r.hash}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('h1');
      await page.waitForFunction(
        (txt) => document.body.textContent && document.body.textContent.includes(txt),
        r.expectedText,
        { timeout: 10000 }
      );
      await sleep(150);

      // Load axe-core from mocked same-origin path so strict script-src 'self' CSP stays intact
      await page.addScriptTag({ url: `${BASE_URL}/__axe.min.js` });
      const axeRes = await page.evaluate(async () => {
        return window.axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          },
        });
      });

      const violations = axeRes.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
        targets: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      }));

      routeReports.push({
        route: r.hash,
        name: r.name,
        ok: true,
        violationCount: violations.length,
      });
      axeReports.push({ route: r.hash, violations });

      const cspList = await page.evaluate(() => window.__airindxCspViolations || []);
      if (cspList.length > 0) cspViolations.push(...cspList);
    }

    // 2. Interactive checks across key flows
    await page.goto(`${BASE_URL}/#/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#globalStandardSelect');
    const cpcbText = await page.locator('main').textContent();
    await page.selectOption('#globalStandardSelect', 'US_EPA');
    await sleep(250);
    const epaText = await page.locator('main').textContent();
    const standardSwitchOk = epaText.includes('US EPA AQI') && epaText !== cpcbText;

    // Switch city to Tokyo
    await page.selectOption('#globalCitySelect', 'tokyo-jp');
    await sleep(250);
    const citySwitchOk = (await page.locator('main').textContent()).includes('Tokyo');
    await page.selectOption('#globalCitySelect', 'mumbai-in');
    await page.selectOption('#globalStandardSelect', 'CPCB_NAQI');
    await sleep(200);

    // Explore Map filters + CAMS offline handling check
    await page.goto(`${BASE_URL}/#/explore-map`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#mapStateFilter');
    await page.selectOption('#mapStateFilter', 'Maharashtra');
    await sleep(200);
    const mapFilterOk = (await page.locator('.inspect-station-btn').count()) >= 3;
    await page.selectOption('#mapStateFilter', 'ALL');

    // Historical filters
    await page.goto(`${BASE_URL}/#/history`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.hist-tf-btn[data-tf="30d"]');
    await page.click('.hist-tf-btn[data-tf="30d"]');
    await sleep(200);
    const historyFilterOk = (await page.locator('main').textContent()).includes('30D');

    // AI Assistant grounded response & deterministic consistency
    await page.goto(`${BASE_URL}/#/ai-assistant`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#aiPromptInput');
    await page.fill('#aiPromptInput', 'Is it safe to exercise outdoors right now?');
    await page.click('#aiPromptForm button[type="submit"]');
    await page.waitForFunction(
      () => document.body.textContent && document.body.textContent.includes('1. Observed Conditions')
    );
    const aiText1 = await page.locator('#aiChatThread').textContent();
    await page.fill('#aiPromptInput', 'Is it safe to exercise outdoors right now?');
    await page.click('#aiPromptForm button[type="submit"]');
    await sleep(200);
    const aiOk = aiText1.includes('1. Observed Conditions') && aiText1.includes('4. Data Limitations');

    // City Comparison add city
    await page.goto(`${BASE_URL}/#/comparison`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#compAddCityBtn');
    const beforeCards = await page.locator('article').count();
    await page.click('#compAddCityBtn');
    await sleep(200);
    const afterCards = await page.locator('article').count();
    const comparisonOk = afterCards === beforeCards + 1;

    // 3. All 5 viewports across all 7 routes + mobile nav check
    const viewportResults = [];
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const r of ROUTES) {
        await page.goto(`${BASE_URL}/${r.hash}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('h1');
        await sleep(80);
        const overflowPx = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        viewportResults.push({
          viewport: vp.name,
          route: r.hash,
          overflowPx,
        });
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/#/`, { waitUntil: 'networkidle' });
    await page.click('#mobileNavToggleBtn');
    await sleep(100);
    const mobileNavOk = await page.evaluate(() => {
      const drawer = document.getElementById('mobileNavDrawer');
      return Boolean(drawer && !drawer.classList.contains('hidden'));
    });

    // 4. Snapshot online-mode network/console/CSP counts before testing intentional offline failure
    const preOfflineExternal = [...externalRequests];
    const preOfflineFailed = [...failedRequests];
    const preOfflineConsole = [...consoleErrors];

    await context.setOffline(true);
    await page.goto(`${BASE_URL}/#/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1');
    const offlineHomeOk = (await page.locator('h1').textContent()).includes('Mumbai');

    await page.goto(`${BASE_URL}/#/explore-map`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#fetchCamsAodBtn');
    await page.click('#fetchCamsAodBtn');
    await sleep(300);
    const offlineCamsText = await page.locator('#camsAodResult').textContent();
    const offlineOk = offlineHomeOk && offlineCamsText.includes('Unavailable');

    await context.close();
    await browser.close();
    browser = null;

    // 5. WebGL fallback + reduced-motion verification
    fallbackBrowser = await chromium.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-webgl', '--disable-3d-apis'],
    });
    const fbContext = await fallbackBrowser.newContext({
      viewport: { width: 1366, height: 768 },
      reducedMotion: 'reduce',
    });
    const fbPage = await fbContext.newPage();
    await fbPage.goto(`${BASE_URL}/#/`, { waitUntil: 'networkidle' });
    await fbPage.waitForSelector('#dashboardGlobeMount img');
    const webglFallbackOk = await fbPage.evaluate(() => {
      const img = document.querySelector('#dashboardGlobeMount img');
      const text = document.querySelector('#dashboardGlobeMount')?.textContent || '';
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      return Boolean(
        img &&
          img.complete &&
          img.naturalWidth > 0 &&
          text.includes('2D Earth Fallback Active') &&
          reduced
      );
    });
    await fbContext.close();
    await fallbackBrowser.close();
    fallbackBrowser = null;

    const totalAxeViolations = axeReports.reduce((sum, r) => sum + r.violations.length, 0);
    const maxOverflowPx = Math.max(...viewportResults.map((v) => v.overflowPx));

    const summary = {
      routeReports,
      totalAxeViolations,
      axeReports: axeReports.filter((r) => r.violations.length > 0),
      interactions: {
        standardSwitchOk,
        citySwitchOk,
        mapFilterOk,
        historyFilterOk,
        aiOk,
        comparisonOk,
        mobileNavOk,
        offlineOk,
        webglFallbackOk,
      },
      viewportCount: viewportResults.length,
      maxOverflowPx,
      externalRequests: preOfflineExternal,
      failedRequests: preOfflineFailed,
      consoleErrors: preOfflineConsole,
      runtimeExceptions,
      cspViolations,
    };

    console.log(JSON.stringify(summary, null, 2));

    if (
      totalAxeViolations > 0 ||
      maxOverflowPx > 0 ||
      preOfflineExternal.length > 0 ||
      preOfflineFailed.length > 0 ||
      cspViolations.length > 0 ||
      preOfflineConsole.length > 0 ||
      runtimeExceptions.length > 0 ||
      Object.values(summary.interactions).some((v) => v !== true)
    ) {
      process.exitCode = 1;
    }
  } finally {
    if (viteErr.trim()) console.error('Vite preview stderr:', viteErr);
    if (browser) await browser.close();
    if (fallbackBrowser) await fallbackBrowser.close();
    viteProc.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
