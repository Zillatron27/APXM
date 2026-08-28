import { describe, it, expect, beforeEach } from 'vitest';
import {
  scanBufferCards,
  deleteBufferCards,
  deleteLastCard,
  commandPrefix,
  openCardList,
} from '../buffer-cards';
import { isActionInFlight, acquireActionLock, releaseActionLock } from '../act/action-lock';

/**
 * Fixture mirroring APEX's mobile Buffer stack (spike capture 2026-08-14):
 * top level shows an h2 "Buffer"; inside, ADD NEW CARD + card rows
 * `li > BtnRemove + h4.Stack__commandSubTitle + .Stack__commandTitle > h3`.
 * The fixture renders both levels at once — the navigator only needs the
 * anchors to exist, and isAtStacksTopLevel stays true so no back-nav runs.
 */
function buildStack(commands: string[], { removeButtons = true } = {}) {
  document.body.innerHTML = '';
  const container = document.createElement('div');
  container.id = 'container';
  document.body.appendChild(container);

  const header = document.createElement('h2');
  header.textContent = 'Buffer';
  container.appendChild(header);

  const add = document.createElement('button');
  add.textContent = 'Add new card';
  container.appendChild(add);

  const list = document.createElement('ul');
  container.appendChild(list);
  for (const cmd of commands) {
    const li = document.createElement('li');
    if (removeButtons) {
      const remove = document.createElement('button');
      remove.className = 'BtnRemove__btnRemove___abc123';
      remove.addEventListener('click', () => li.remove());
      li.appendChild(remove);
    }
    const sub = document.createElement('h4');
    sub.className = 'Stack__commandSubTitle___xyz';
    sub.textContent = cmd;
    li.appendChild(sub);
    const titleWrap = document.createElement('div');
    titleWrap.className = 'Stack__commandTitle___xyz';
    const h3 = document.createElement('h3');
    h3.textContent = `Title of ${cmd}`;
    titleWrap.appendChild(h3);
    li.appendChild(titleWrap);
    list.appendChild(li);
  }
  return { container, list };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('commandPrefix', () => {
  it('takes the first token, uppercased', () => {
    expect(commandPrefix('cont 12345')).toBe('CONT');
    expect(commandPrefix('  INV abc-def ')).toBe('INV');
    expect(commandPrefix('FLT')).toBe('FLT');
  });
});

describe('scanBufferCards', () => {
  it('lists every card with command and title', async () => {
    buildStack(['CONT 111', 'INV aaa', 'SFC AVI-1']);
    const result = await scanBufferCards();
    expect(result).toEqual({
      ok: true,
      cards: [
        { command: 'CONT 111', title: 'Title of CONT 111' },
        { command: 'INV aaa', title: 'Title of INV aaa' },
        { command: 'SFC AVI-1', title: 'Title of SFC AVI-1' },
      ],
    });
    expect(isActionInFlight()).toBe(false);
  });

  it('refuses while another action holds the lock', async () => {
    buildStack(['CONT 111']);
    acquireActionLock();
    const result = await scanBufferCards();
    releaseActionLock();
    expect(result.ok).toBe(false);
  });

  it('restores container styles after the scan', async () => {
    const { container } = buildStack(['CONT 111']);
    container.style.position = 'relative';
    await scanBufferCards();
    expect(container.style.position).toBe('relative');
    expect(container.style.visibility).toBe('');
  });
});

describe('deleteBufferCards', () => {
  it('deletes only cards in the selected prefixes and reports the count', async () => {
    const { list } = buildStack(['CONT 111', 'INV aaa', 'CONT 222', 'FLT']);
    const result = await deleteBufferCards(new Set(['CONT', 'FLT']));
    expect(result).toEqual({ ok: true, deleted: 3 });
    const remaining = Array.from(list.querySelectorAll('h4')).map((h) => h.textContent);
    expect(remaining).toEqual(['INV aaa']);
    expect(isActionInFlight()).toBe(false);
  });

  it('deletes nothing when no card matches', async () => {
    buildStack(['CONT 111']);
    const result = await deleteBufferCards(new Set(['SFC']));
    expect(result).toEqual({ ok: true, deleted: 0 });
  });

  it('toggles edit mode when rows carry no remove button', async () => {
    const { list } = buildStack(['CONT 111'], { removeButtons: false });
    // Edit toggle: revealing remove buttons on click, as APEX's edit mode does.
    const edit = document.createElement('button');
    edit.textContent = 'Edit';
    document.getElementById('container')!.appendChild(edit);
    edit.addEventListener('click', () => {
      for (const li of list.querySelectorAll('li')) {
        const remove = document.createElement('button');
        remove.className = 'BtnRemove__btnRemove___abc123';
        remove.addEventListener('click', () => li.remove());
        li.prepend(remove);
      }
    });
    const result = await deleteBufferCards(new Set(['CONT']));
    expect(result).toEqual({ ok: true, deleted: 1 });
    expect(list.querySelectorAll('li').length).toBe(0);
  });

  it('exits edit mode via STOP EDITING even when deletes entered it implicitly', async () => {
    // Device 2026-08-19: BtnRemove clicks put the Stack into edit mode on
    // their own; APEX renders a bottom-bar STOP EDITING button and blocks
    // Stack navigation until it is tapped.
    const { list } = buildStack(['CONT 111']);
    const container = document.getElementById('container')!;
    let stopClicks = 0;
    list.querySelector('button')!.addEventListener('click', () => {
      if (document.querySelector('[class*="Stack__edit"]')) return;
      const editBar = document.createElement('div');
      editBar.className = 'Stack__edit___xyz';
      const stop = document.createElement('button');
      stop.textContent = 'Stop editing';
      stop.addEventListener('click', () => {
        stopClicks++;
        editBar.remove();
      });
      editBar.appendChild(stop);
      container.appendChild(editBar);
    });
    const result = await deleteBufferCards(new Set(['CONT']));
    expect(result).toEqual({ ok: true, deleted: 1 });
    expect(stopClicks).toBe(1);
    expect(document.querySelector('[class*="Stack__edit"]')).toBeNull();
  });

  it('aborts when a remove click does not shrink the list (no hammering a re-rendered DOM)', async () => {
    const { list } = buildStack(['CONT 111', 'CONT 222']);
    // First row's remove is a silent no-op — the row never leaves the DOM.
    const firstRemove = list.querySelector<HTMLButtonElement>('button')!;
    const dead = firstRemove.cloneNode(true) as HTMLButtonElement; // clone drops the listener
    firstRemove.replaceWith(dead);
    const result = await deleteBufferCards(new Set(['CONT']));
    expect(result.ok).toBe(false);
    expect(result.deleted).toBe(0);
    expect(list.querySelectorAll('li').length).toBe(2);
    expect(isActionInFlight()).toBe(false);
  }, 10000);

  it('aborts with an error when no remove button exists even after edit', async () => {
    buildStack(['CONT 111'], { removeButtons: false });
    const result = await deleteBufferCards(new Set(['CONT']));
    expect(result.ok).toBe(false);
    expect(result.deleted).toBe(0);
    expect(isActionInFlight()).toBe(false);
  });
});

describe('deleteLastCard', () => {
  // Used by mobile-buffer-navigator's opt-in appended-card sweep, which
  // removes by POSITION rather than by command — there's no gap in coverage
  // here beyond what these two cases need: it removes whatever is last, and
  // it reports failure like removeCardRow does for every other delete path.
  it('removes the last row in the list regardless of its command', async () => {
    const { list } = buildStack(['CONT 111', 'INV aaa', 'FLT']);
    expect(await openCardList()).toBe(true);

    expect(await deleteLastCard()).toBe(true);

    const remaining = Array.from(list.querySelectorAll('h4')).map((h) => h.textContent);
    expect(remaining).toEqual(['CONT 111', 'INV aaa']);
  });

  it('returns false when the list is already empty', async () => {
    buildStack([]);
    expect(await openCardList()).toBe(true);
    expect(await deleteLastCard()).toBe(false);
  });
});
