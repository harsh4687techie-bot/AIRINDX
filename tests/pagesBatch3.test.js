import { describe, it, expect, beforeEach } from 'vitest';
import { appState } from '../src/state/appState.js';
import { renderAiAssistant } from '../src/pages/aiAssistant.js';
import { renderCityComparison } from '../src/pages/cityComparison.js';

describe('Page migrations: AI Assistant & City Comparison', () => {
  beforeEach(() => {
    appState.reset();
  });

  it('renders AI Assistant empty state, sends grounded message, and escapes XSS input', async () => {
    const container = document.createElement('div');
    await renderAiAssistant(container);

    expect(container.querySelector('[data-empty-chat]')).not.toBeNull();
    expect(container.textContent).toContain('not personal medical advice');

    const input = container.querySelector('#aiPromptInput');
    const form = container.querySelector('#aiPromptForm');
    input.value = '<script>alert(1)</script> Is it safe to exercise outdoors?';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await new Promise((r) => setTimeout(r, 30));

    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('1. Observed Conditions');
    expect(container.textContent).toContain('2. Interpretation');
    expect(container.textContent).toContain('3. Recommendations');
    expect(container.textContent).toContain('4. Data Limitations');
    expect(container.textContent).toContain('Mumbai');
  });

  it('renders City Comparison with add/remove city and ranking methodology', async () => {
    const container = document.createElement('div');
    await renderCityComparison(container);

    expect(container.textContent).toContain('Ranking Methodology');
    expect(container.textContent).toContain('Cleanest in Selection');
    expect(container.textContent).toContain('Mumbai');

    // Add Nagpur via select + button
    const select = container.querySelector('#compAddCitySelect');
    select.value = 'nagpur-in';
    container.querySelector('#compAddCityBtn').click();

    await new Promise((r) => setTimeout(r, 30));
    expect(appState.getState().comparisonCityIds).toContain('nagpur-in');
  });
});
