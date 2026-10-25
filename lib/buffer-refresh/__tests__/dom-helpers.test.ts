import { describe, it, expect, beforeEach } from 'vitest';
import { findCancelButton } from '../dom-helpers';

function button(text: string, parent: HTMLElement): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  parent.appendChild(btn);
  return btn;
}

let container: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  container.id = 'container';
  document.body.appendChild(container);
});

describe('findCancelButton', () => {
  it('ignores a game Cancel button when no add-card form is open', () => {
    button('Cancel', container);
    expect(findCancelButton()).toBeNull();
  });

  it('returns the add-card form Cancel, not a game Cancel elsewhere in the buffer', () => {
    const gameCancel = button('Cancel', container);
    const form = document.createElement('div');
    container.appendChild(form);
    button('Create', form);
    const formCancel = button('Cancel', form);

    expect(findCancelButton()).toBe(formCancel);
    expect(findCancelButton()).not.toBe(gameCancel);
  });
});
