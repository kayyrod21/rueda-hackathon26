// Dependency-free hook/viewport harness; TypeScript is the project's existing dev dependency.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative, imports, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2017 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require(name) {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, ...globals }, { filename: relative });
  return module.exports;
}
const helper = load('src/app/lib/concierge/chatScroll.ts', {});

function harness() {
  const slots = []; let cursor = 0; let pendingEffects = [];
  const viewport = { scrollTop: 0, scrollHeight: 100, scrollIntoView() { throw new Error('Ancestor scrolling forbidden'); } };
  const page = { scrollY: 240, scrollTo() { throw new Error('Window scrolling forbidden'); } };
  const modal = { scrollTop: 70 };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: initial };
      return [slots[index].value, (next) => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(fn, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) pendingEffects.push(fn);
      slots[index] = { dependencies };
    },
  };
  let resolveFetch;
  const fetch = () => new Promise(resolve => { resolveFetch = resolve; });
  const jsx = (type, props) => ({ type, props });
  const { RuedaConciergeChat } = load('src/app/components/RuedaConciergeChat.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-i18next': { useTranslation: () => ({ i18n: { language: 'en' } }) },
    'lucide-react': { Bot: () => null, Send: () => null },
    '../lib/concierge/chatScroll': helper,
  }, { fetch, window: page });
  function nodes(value) {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== 'object') return [];
    return [value, ...nodes(value.props?.children)];
  }
  let tree;
  function render() {
    cursor = 0; pendingEffects = [];
    tree = RuedaConciergeChat();
    const log = nodes(tree).find(node => node.props?.role === 'log');
    assert.ok(log.props.className.includes('overflow-y-auto'));
    log.props.ref.current = viewport;
    for (const effect of pendingEffects) effect();
    return tree;
  }
  return { render, viewport, page, modal, nodes, slots,
    reply(data) { resolveFetch({ ok: true, json: async () => data }); },
    find(type) { return nodes(tree).find(node => node.type === type); },
  };
}

test('scroll helper changes only the supplied viewport and tolerates a missing ref', () => {
  helper.scrollChatToNewest(null);
  const chat = { scrollTop: 0, scrollHeight: 900 };
  helper.scrollChatToNewest(chat);
  assert.equal(chat.scrollTop, 900);
});

test('user and assistant arrivals scroll the chat without moving page or modal', async () => {
  const h = harness(); h.render();
  assert.equal(h.viewport.scrollTop, 100);
  h.find('input').props.onChange({ target: { value: 'Miami tomorrow at 3pm' } });
  h.render();
  const promise = h.find('form').props.onSubmit({ preventDefault() {} });
  h.viewport.scrollHeight = 300; h.render();
  assert.equal(h.viewport.scrollTop, 300, 'user message must be visible');
  h.reply({ conversation_id: 'test', booking: null, reply: 'Miami · America/New_York', language: 'es' });
  await promise;
  h.viewport.scrollHeight = 600; h.render();
  assert.equal(h.viewport.scrollTop, 600, 'assistant response must be visible');
  assert.equal(h.page.scrollY, 240); assert.equal(h.modal.scrollTop, 70);
  assert.equal(h.find('button').props['aria-label'], 'Enviar mensaje');
});

test('a new assistant message scrolls even when loading is unchanged', () => {
  const h = harness(); h.render();
  const messages = h.slots.find(slot => Array.isArray(slot.value));
  messages.value = [...messages.value, { role: 'assistant', content: 'Additional response' }];
  h.viewport.scrollHeight = 450; h.render();
  assert.equal(h.viewport.scrollTop, 450);
  assert.equal(h.page.scrollY, 240); assert.equal(h.modal.scrollTop, 70);
});
