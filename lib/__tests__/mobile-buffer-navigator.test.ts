import { describe, it, expect, beforeEach } from 'vitest';
import { openMobileBuffer, closeMobileBuffer } from '../mobile-buffer-navigator';

/**
 * Scripted APEX mobile Stack fixture driving the full open flow: Buffer
 * header → ADD NEW CARD → command input + CREATE → card li (BtnRemove
 * removes it) → FormComponent renders on card open. Lets the navigator's
 * #84 card cleanup be tested end-to-end: openMobileBuffer creates a card,
 * closeMobileBuffer must delete it — and only it.
 */
function buildApexStack({ existingCards = [] as string[] } = {}) {
  document.body.innerHTML = '';
  const container = document.createElement('div');
  container.id = 'container';
  document.body.appendChild(container);

  const header = document.createElement('h2');
  header.textContent = 'Buffer';
  container.appendChild(header);

  const list = document.createElement('ul');
  container.appendChild(list);

  function addCard(command: string) {
    const li = document.createElement('li');
    const remove = document.createElement('button');
    remove.className = 'BtnRemove__btnRemove___abc';
    remove.addEventListener('click', () => li.remove());
    li.appendChild(remove);
    const sub = document.createElement('h4');
    sub.className = 'Stack__commandSubTitle___x';
    sub.textContent = command;
    li.appendChild(sub);
    li.addEventListener('click', () => {
      // Opening a card renders its buffer form.
      if (!container.querySelector('[class*="FormComponent__container"]')) {
        const form = document.createElement('div');
        form.className = 'FormComponent__containerActive___x';
        container.appendChild(form);
      }
    });
    list.appendChild(li);
    return li;
  }

  for (const cmd of existingCards) addCard(cmd).classList.add('user-card');

  const add = document.createElement('button');
  add.textContent = 'Add new card';
  container.appendChild(add);
  add.addEventListener('click', () => {
    const wrap = document.createElement('div');
    wrap.textContent = 'Enter content command';
    const input = document.createElement('input');
    input.type = 'text';
    // jsdom has no layout — getCommandInput's visibility check needs this.
    Object.defineProperty(input, 'offsetParent', { get: () => document.body });
    wrap.appendChild(input);
    container.appendChild(wrap);
    const create = document.createElement('button');
    create.textContent = 'Create';
    create.addEventListener('click', () => {
      addCard(input.value);
      wrap.remove();
      create.remove();
    });
    container.appendChild(create);
  });

  return { container, list };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('openMobileBuffer / closeMobileBuffer card cleanup (#84)', () => {
  it('deletes the card it created on close', async () => {
    const { list } = buildApexStack();
    expect(await openMobileBuffer('FLT')).toBe(true);
    expect(list.querySelectorAll('li').length).toBe(1);
    await closeMobileBuffer();
    expect(list.querySelectorAll('li').length).toBe(0);
  });

  it('leaves a pre-existing user card with the same command untouched', async () => {
    const { list } = buildApexStack({ existingCards: ['FLT'] });
    expect(await openMobileBuffer('FLT')).toBe(true);
    expect(list.querySelectorAll('li').length).toBe(2);
    await closeMobileBuffer();
    const remaining = list.querySelectorAll('li');
    expect(remaining.length).toBe(1);
    // The SURVIVOR must be the user's original card, not the created one.
    expect(remaining[0].classList.contains('user-card')).toBe(true);
  });

  it('sweeps every card of a multi-open action package on the one close', async () => {
    const { list } = buildApexStack();
    expect(await openMobileBuffer('CONT 1')).toBe(true);
    expect(await openMobileBuffer('INV abc')).toBe(true);
    expect(list.querySelectorAll('li').length).toBe(2);
    await closeMobileBuffer();
    expect(list.querySelectorAll('li').length).toBe(0);
  });

  it('restores container styles after close', async () => {
    const { container } = buildApexStack();
    container.style.position = 'relative';
    await openMobileBuffer('FLT');
    await closeMobileBuffer();
    expect(container.style.position).toBe('relative');
    expect(container.style.visibility).toBe('');
  });
});
