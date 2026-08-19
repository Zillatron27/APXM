/**
 * Scripted APEX mobile Stack fixture driving the full card-create flow:
 * Buffer header → ADD NEW CARD → command input + CREATE → card li
 * (BtnRemove removes it) → FormComponent renders on card open. Shared by
 * the navigator and buffer-refresh engine tests for the #84 card cleanup.
 */
export function buildApexStack({ existingCards = [] as string[] } = {}) {

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
