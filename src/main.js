import './styles/main.css';
import { renderNavbar, bindNavbarEvents } from './components/Navbar.js';
import { renderFooter } from './components/Footer.js';
import { createRouter } from './router.js';
import { appState } from './state/appState.js';
import { runContainerCleanup, registerContainerCleanup } from './utils/lifecycle.js';

// Lazy-load page modules so heavy views (e.g. Three.js) load only when needed
const PAGE_ROUTES = {
  '/': async (container) => {
    const { renderLiveDashboard } = await import('./pages/liveDashboard.js');
    return renderLiveDashboard(container);
  },
  '/explore-map': async (container) => {
    const { renderExploreMap } = await import('./pages/exploreMap.js');
    return renderExploreMap(container);
  },
  '/pollutants': async (container) => {
    const { renderPollutants } = await import('./pages/pollutants.js');
    return renderPollutants(container);
  },
  '/history': async (container) => {
    const { renderHistoricalAnalysis } = await import('./pages/historicalAnalysis.js');
    return renderHistoricalAnalysis(container);
  },
  '/weather': async (container) => {
    const { renderWeather } = await import('./pages/weather.js');
    return renderWeather(container);
  },
  '/ai-assistant': async (container) => {
    const { renderAiAssistant } = await import('./pages/aiAssistant.js');
    return renderAiAssistant(container);
  },
  '/comparison': async (container) => {
    const { renderCityComparison } = await import('./pages/cityComparison.js');
    return renderCityComparison(container);
  },
};

function mountApp() {
  const root = document.getElementById('app');
  if (!root) return;

  let activePath = '/';
  let pageContainer = null;

  const router = createRouter({
    routes: PAGE_ROUTES,
    onRender: async (path, pageRenderer, isCurrent) => {
      activePath = path;
      if (pageContainer) runContainerCleanup(pageContainer);

      root.innerHTML = `
        <a href="#page-content" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-aqi-good focus:font-title-card focus:text-xs">
          Skip to main content
        </a>
        ${renderNavbar({ currentPath: path })}
        <main id="page-content" tabindex="-1" class="w-full pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-8 focus:outline-none"></main>
        ${renderFooter()}
      `;

      bindNavbarEvents(root);
      pageContainer = root.querySelector('#page-content');
      const cleanup = await pageRenderer(pageContainer);
      if (!isCurrent()) {
        if (typeof cleanup === 'function') cleanup();
        return null;
      }
      if (typeof cleanup === 'function') {
        registerContainerCleanup(pageContainer, cleanup);
      }
      return () => runContainerCleanup(pageContainer);
    },
  });

  let prevCityId = appState.getState().selectedCityId;
  let prevStationId = appState.getState().selectedStationId;
  let prevStandard = appState.getState().aqiStandard;

  appState.subscribe((next) => {
    const coreChanged =
      next.selectedCityId !== prevCityId ||
      next.selectedStationId !== prevStationId ||
      next.aqiStandard !== prevStandard;

    if (coreChanged) {
      prevCityId = next.selectedCityId;
      prevStationId = next.selectedStationId;
      prevStandard = next.aqiStandard;
      router.renderRoute();
    } else {
      const headerEl = root.querySelector('header');
      if (headerEl) {
        const tmp = document.createElement('div');
        tmp.innerHTML = renderNavbar({ currentPath: activePath });
        const nextHeader = tmp.firstElementChild;
        if (nextHeader) {
          headerEl.replaceWith(nextHeader);
          bindNavbarEvents(root);
        }
      }
    }
  });

  router.start();
}

mountApp();
