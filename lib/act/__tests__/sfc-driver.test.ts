// SFC session driver against a fixture of the mobile SFC form (device
// capture 2026-08-14): AddressSelector input + role=option suggestions,
// MissionPlan table (header, totals row, segments), rc-slider marks,
// RadioItem toggles, route-pref select, start button, Status field.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../mobile-buffer-navigator', () => ({
  openMobileBuffer: vi.fn(async () => true),
  closeMobileBuffer: vi.fn(async () => {}),
}));

import { openMobileBuffer, closeMobileBuffer } from '../../mobile-buffer-navigator';
import { openSendSession } from '../sfc-driver';
import { installInputBridge } from '../input-bridge-main';
import { isActionInFlight } from '../action-lock';

// jsdom is single-world: the input-bridge responder runs in the same document
// and performs the typing/click sequences the driver requests.
installInputBridge();
import { useFlightsStore } from '../../../stores/entities';
import { createTestFlight } from '../../../__tests__/fixtures/factories';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text = ''
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

interface Fixture {
  container: HTMLElement;
  input: HTMLInputElement;
  status: HTMLElement;
  startBtn: HTMLButtonElement;
  setSuggestions: (labels: string[]) => void;
  setRoute: (durations: string) => void;
}

function buildSfcFixture(): Fixture {
  const container = el('div', '');
  container.id = 'container';
  document.body.appendChild(container);

  const input = el('input', 'AddressSelector__input___h') as HTMLInputElement;
  input.type = 'search';
  container.appendChild(input);

  const suggestions = el('ul', '');
  container.appendChild(suggestions);
  const setSuggestions = (labels: string[]) => {
    suggestions.innerHTML = '';
    for (const label of labels) {
      const li = el('li', '', label);
      li.setAttribute('role', 'option');
      suggestions.appendChild(li);
    }
  };

  const statusField = el('div', 'FormComponent__container___h');
  statusField.append(el('span', '', 'Status'), el('span', '', ''));
  container.appendChild(statusField);
  const status = statusField.children[1] as HTMLElement;

  const table = el('table', 'MissionPlan__table___h');
  container.appendChild(table);
  const setRoute = (duration: string) => {
    table.innerHTML = '';
    const rows = [
      ['#', 'Type', 'Destination', 'Duration', 'Distance', 'Damage', 'Fees', 'Consumption'],
      ['', '', 'Benten Station', duration, '656m km', '0.198%', '12,000 AIC', '165 units'],
      ['0', 'TRA', 'Heph (orbit)', '1h 23m', '73m km', '0.05%', '--', '38 units'],
    ];
    for (const cells of rows) {
      const tr = document.createElement('tr');
      for (const c of cells) tr.appendChild(el('td', '', c));
      table.appendChild(tr);
    }
  };

  // Any control change "recomputes" — the totals cell mutates, which is the
  // signal the driver waits on (as live APEX behaves).
  const bump = () => {
    const td = table.querySelector('tr:nth-child(2) td:nth-child(4)');
    if (td) td.textContent += '.';
  };

  // Usage sliders: labelled FormComponent + rc-slider whose handle carries
  // the aria value scale (0.01–1, as device-captured). Rail clicks set the
  // value from clientX; jsdom rects are zero, so the rect is stubbed.
  const mkUsageSlider = (label: string, now: number) => {
    const field = el('div', 'FormComponent__container___h');
    field.appendChild(el('span', '', label));
    const s = el('div', 'rc-slider');
    (s as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 10, right: 100, bottom: 10, x: 0, y: 0 }) as DOMRect;
    const handle = el('span', 'rc-slider-handle');
    handle.setAttribute('aria-valuemin', '0.01');
    handle.setAttribute('aria-valuemax', '1');
    handle.setAttribute('aria-valuenow', String(now));
    s.appendChild(handle);
    // rc-slider sets the value on mousedown at the position (the drag model
    // the bridge speaks: mousedown on the slider, mouseup on the document).
    s.addEventListener('mousedown', (e) => {
      const frac = (e as MouseEvent).clientX / 100;
      handle.setAttribute('aria-valuenow', String(0.01 + frac * 0.99));
      bump();
    });
    field.appendChild(s);
    return field;
  };
  container.appendChild(mkUsageSlider('Fuel usage', 0.05));
  container.appendChild(mkUsageSlider('Reactor usage', 0.53));

  // Toggles.
  const mkRadio = (label: string, active: boolean) => {
    const span = el('span', 'RadioItem__container___h');
    const indicator = el('div', `RadioItem__indicator___h${active ? ' RadioItem__active___h' : ''}`);
    span.appendChild(indicator);
    span.appendChild(el('div', 'RadioItem__value___h', label));
    span.addEventListener('click', () => {
      indicator.className = indicator.className.includes('RadioItem__active')
        ? 'RadioItem__indicator___h'
        : 'RadioItem__indicator___h RadioItem__active___h';
      bump();
    });
    return span;
  };
  container.appendChild(mkRadio('Surface landing', true));
  container.appendChild(mkRadio('Use gateways', true));
  container.appendChild(mkRadio('Unload on arrival', false));

  const select = document.createElement('select');
  for (const [v, t] of [
    ['LEAST_JUMPS', 'least jumps'],
    ['SHORTEST_FTL', 'shortest FTL route'],
  ]) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = t;
    select.appendChild(o);
  }
  select.addEventListener('change', bump);
  container.appendChild(select);

  const startBtn = el('button', 'apex-btn', 'start') as HTMLButtonElement;
  container.appendChild(startBtn);

  return { container, input, status, startBtn, setSuggestions, setRoute };
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.mocked(openMobileBuffer).mockClear();
  vi.mocked(closeMobileBuffer).mockClear();
  useFlightsStore.getState().clear();
});

describe('SendSession', () => {
  it('opens SFC for the registration and holds the shared lock until close', async () => {
    buildSfcFixture();
    const opened = await openSendSession('AVI-063I6', 'ship-1');
    expect(opened.ok).toBe(true);
    expect(openMobileBuffer).toHaveBeenCalledWith('SFC AVI-063I6', expect.any(Function));
    expect(isActionInFlight()).toBe(true);
    if (opened.ok) await opened.session.close();
    expect(isActionInFlight()).toBe(false);
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
  });

  it('sets the destination (char-by-char + suggestion match) and reads the snapshot', async () => {
    const fx = buildSfcFixture();
    fx.input.addEventListener('input', () => {
      if (fx.input.value === 'Benten Station') {
        fx.setSuggestions(['Benten Station (Benten)', 'Benten - Biogenesis (UV-351d)']);
      }
    });
    fx.container.querySelector('ul')!.addEventListener('click', () => {
      fx.status.textContent = 'valid';
      fx.setRoute('1 day 2h 48m');
    });

    const opened = await openSendSession('AVI-063I6', 'ship-1');
    if (!opened.ok) throw new Error('open failed');
    const result = await opened.session.setDestination({
      query: 'Benten Station',
      label: 'Benten Station (Benten)',
    });
    expect(result.ok).toBe(true);

    const snap = opened.session.readSnapshot();
    expect(snap.status).toBe('valid');
    expect(snap.totals?.duration).toBe('1 day 2h 48m');
    expect(snap.segments).toHaveLength(1);
    expect(snap.reactor).toEqual({
      valuePct: 53,
      posFrac: (0.53 - 0.01) / 0.99,
      minPct: 1,
      maxPct: 100,
    });
    expect(snap.fuel?.valuePct).toBe(5);
    expect(snap.surfaceLanding).toBe(true);
    expect(snap.unloadOnArrival).toBe(false);
    expect(snap.routePref).toBe('LEAST_JUMPS');
    await opened.session.close();
  }, 15000);

  it('matches a base suggestion by naturalId suffix when the label differs', async () => {
    const fx = buildSfcFixture();
    fx.input.addEventListener('input', () => {
      if (fx.input.value === 'Bober') {
        // APEX renders the FULL planet label; the WS-derived label is shorter.
        fx.setSuggestions(['Antares I - Bober (ZV-307b)']);
      }
    });
    fx.container.querySelector('ul')!.addEventListener('click', () => {
      fx.status.textContent = 'valid';
      fx.setRoute('4h');
    });
    const opened = await openSendSession('AVI-063I6', 'ship-1');
    if (!opened.ok) throw new Error('open failed');
    const result = await opened.session.setDestination({
      query: 'Bober',
      label: 'Bober (ZV-307b)',
      naturalId: 'ZV-307b',
    });
    expect(result.ok).toBe(true);
    expect(opened.session.readSnapshot().status).toBe('valid');
    await opened.session.close();
  }, 15000);

  it('refuses the destination when the suggestion never appears (no guessing)', async () => {
    buildSfcFixture(); // suggestions never populate
    const opened = await openSendSession('AVI-063I6', 'ship-1');
    if (!opened.ok) throw new Error('open failed');
    const result = await opened.session.setDestination({
      query: 'Nowhere',
      label: 'Nowhere (XX-000x)',
      naturalId: 'XX-000x',
    });
    expect(result.ok).toBe(false);
    await opened.session.close();
  }, 15000);

  it('slider marks and toggles drive the fixture and read back', async () => {
    const fx = buildSfcFixture();
    fx.setRoute('1 day');
    const opened = await openSendSession('AVI-063I6', 'ship-1');
    if (!opened.ok) throw new Error('open failed');
    const { session } = opened;
    await session.setSliderFraction('reactor', 0.75);
    // Fixture scale 0.01–1: position 0.75 → value 0.01 + 0.75×0.99 = 0.7525.
    expect(session.readSnapshot().reactor?.posFrac).toBeCloseTo(0.75, 5);
    await session.toggle('Unload on arrival');
    expect(session.readSnapshot().unloadOnArrival).toBe(true);
    await session.setRoutePref('SHORTEST_FTL');
    expect(session.readSnapshot().routePref).toBe('SHORTEST_FTL');
    await session.close();
  }, 60000);

  it('commitStart refuses while APEX says the route is not valid', async () => {
    const fx = buildSfcFixture();
    fx.status.textContent = 'equal origin and destination';
    const opened = await openSendSession('AVI-063I6', 'ship-1');
    if (!opened.ok) throw new Error('open failed');
    const result = await opened.session.commitStart();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('equal origin and destination');
    await opened.session.close();
  });

  it('commitStart clicks START, completes the confirmation overlay, and confirms via the flight delta', async () => {
    const fx = buildSfcFixture();
    fx.status.textContent = 'valid';
    fx.setRoute('1 day');
    // Device-confirmed 2026-08-14: START pops ActionConfirmationOverlay with
    // Cancel + a second "start"; the flight begins only after the confirm.
    fx.startBtn.addEventListener('click', () => {
      const overlay = el('div', 'ActionConfirmationOverlay__container___h');
      const cancel = el('button', 'apex-btn', 'Cancel');
      const confirm = el('button', 'apex-btn', 'start');
      confirm.addEventListener('click', () => {
        overlay.remove();
        setTimeout(() => {
          useFlightsStore.getState().setAll([createTestFlight({ shipId: 'ship-1' })]);
        }, 50);
      });
      overlay.append(cancel, confirm);
      document.body.appendChild(overlay);
    });
    const opened = await openSendSession('AVI-063I6', 'ship-1');
    if (!opened.ok) throw new Error('open failed');
    const result = await opened.session.commitStart();
    expect(result).toEqual({ ok: true });
    // The confirmation must have been completed (overlay removed by confirm).
    expect(document.querySelector('[class*="ActionConfirmationOverlay"]')).toBeNull();
    await opened.session.close();
  });

  it('commitStart succeeds even for a repeat flight (stale flight record present)', async () => {
    const fx = buildSfcFixture();
    fx.status.textContent = 'valid';
    fx.setRoute('1 day');
    useFlightsStore.getState().setAll([createTestFlight({ id: 'flight-old', shipId: 'ship-1' })]);
    fx.startBtn.addEventListener('click', () => {
      const overlay = el('div', 'ActionConfirmationOverlay__container___h');
      const confirm = el('button', 'apex-btn', 'start');
      confirm.addEventListener('click', () => {
        overlay.remove();
        // The delta ADDS the new flight — the stale cached one stays. A
        // find-first check stares at the old record and times out while the
        // ship departs (device 2026-08-14).
        useFlightsStore.getState().setAll([
          createTestFlight({ id: 'flight-old', shipId: 'ship-1' }),
          createTestFlight({ id: 'flight-new', shipId: 'ship-1' }),
        ]);
      });
      overlay.append(confirm);
      document.body.appendChild(overlay);
    });
    const opened = await openSendSession('AVI-063I6', 'ship-1');
    if (!opened.ok) throw new Error('open failed');
    const result = await opened.session.commitStart();
    expect(result).toEqual({ ok: true });
    await opened.session.close();
  });

  it('a failed open releases the lock immediately', async () => {
    vi.mocked(openMobileBuffer).mockResolvedValueOnce(false);
    const opened = await openSendSession('AVI-063I6', 'ship-1');
    expect(opened.ok).toBe(false);
    expect(isActionInFlight()).toBe(false);
  });

  it('close is idempotent', async () => {
    buildSfcFixture();
    const opened = await openSendSession('AVI-063I6', 'ship-1');
    if (!opened.ok) throw new Error('open failed');
    await opened.session.close();
    await opened.session.close();
    expect(closeMobileBuffer).toHaveBeenCalledTimes(1);
    expect(isActionInFlight()).toBe(false);
  });
});
