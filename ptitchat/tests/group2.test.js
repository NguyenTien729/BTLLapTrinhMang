import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { transform } from 'esbuild';
import { JSDOM } from 'jsdom';

test('Group 2 Features: Reactions, Pin Message, System Activity Message, Change Password Form', async (t) => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:5173' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};

  const source = (await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'))
    .replace("from './data'", "from './data.js'")
    .replace("from './storage'", "from './storage.js'");
  const compiled = await transform(source, { loader: 'jsx', format: 'esm' });
  const temp = new URL('../src/.App.group2-test-tmp.mjs', import.meta.url);
  await writeFile(temp, compiled.code);

  const React = await import('react');
  const { act } = React;
  const { createRoot } = await import('react-dom/client');
  const { default: App } = await import(temp.href);
  const root = createRoot(document.querySelector('#root'));

  t.after(async () => {
    await act(() => root.unmount());
    await unlink(temp);
    dom.window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  const click = async (el) => {
    assert.ok(el, 'Expected clickable element');
    await act(async () => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  };
  const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
  async function fill(el, value) {
    assert.ok(el, 'Expected input');
    const prototype = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(el, value);
      el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
  }
  const submit = async (form) => {
    await act(async () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  };

  // 1. Render App and enter demo mode
  await act(() => root.render(React.createElement(App)));
  await click(button('Trải nghiệm bản demo'));
  assert.equal(document.querySelector('.chat-header h2').textContent.trim(), 'Đồ án tốt nghiệp 🎓');

  // 2. Send a test message to react and pin
  await fill(document.querySelector('textarea[aria-label="Nội dung tin nhắn"]'), 'Tin nhắn thử nghiệm Nhóm 2');
  await submit(document.querySelector('.composer-area'));
  assert.match(document.querySelector('[role="log"]').textContent, /Tin nhắn thử nghiệm Nhóm 2/);

  // 3. Test Pin / Unpin Message
  const pinBtns = document.querySelectorAll('.msg-action-btn[title="Ghim tin nhắn"]');
  assert.ok(pinBtns.length > 0, 'Should have pin buttons on messages');
  // Click pin on latest message
  await click(pinBtns[pinBtns.length - 1]);
  // Verify pinned bar appears
  const pinnedBar = document.querySelector('.pinned-message-bar');
  assert.ok(pinnedBar, 'Pinned message bar should appear at top');
  assert.match(pinnedBar.textContent, /Tin nhắn đã ghim:/);
  assert.match(pinnedBar.textContent, /Tin nhắn thử nghiệm Nhóm 2/);

  // Unpin using the unpin button in the pinned bar
  const unpinBtn = document.querySelector('.btn-unpin-msg');
  assert.ok(unpinBtn, 'Should have unpin button in pinned message bar');
  await click(unpinBtn);
  assert.equal(document.querySelector('.pinned-message-bar'), null, 'Pinned message bar should disappear after unpinning');

  // 4. Test Message Reactions
  const reactBtns = document.querySelectorAll('.msg-action-btn[title="Thả cảm xúc"]');
  assert.ok(reactBtns.length > 0, 'Should have reaction trigger buttons');
  await click(reactBtns[reactBtns.length - 1]);
  // Popover should appear
  const popover = document.querySelector('.reaction-picker-popover');
  assert.ok(popover, 'Reaction picker popover should be open');
  const emojiButtons = popover.querySelectorAll('.reaction-emoji-btn');
  assert.equal(emojiButtons.length, 6, 'Should show 6 reaction emojis (👍 ❤️ 😂 😮 😢 😡)');
  
  // Click thumbs up 👍
  await click(emojiButtons[0]);
  // Check reaction pill appears on the message
  const reactionPill = document.querySelector('.reaction-pill');
  assert.ok(reactionPill, 'Reaction pill should appear on the message');
  assert.match(reactionPill.textContent, /👍/);
  assert.match(reactionPill.textContent, /1/);

  // Click the reaction pill directly to toggle off
  await click(reactionPill);
  assert.equal(document.querySelector('.reaction-pill'), null, 'Reaction pill should be removed when toggled off');

  // 5. Test Change Password Section in Settings
  await click(document.querySelector('button[aria-label="Cài đặt"]'));
  assert.ok(document.querySelector('.settings-content'), 'Settings modal should be open');
  const togglePassBtn = document.querySelector('.change-password-btn-toggle');
  assert.ok(togglePassBtn, 'Change password accordion button should be visible in settings');
  await click(togglePassBtn);

  // Inputs should be visible
  const passInputs = document.querySelectorAll('.change-password-fields input');
  assert.equal(passInputs.length, 3, 'Should have 3 password inputs (current, new, confirm)');
  await fill(passInputs[0], 'oldpass123');
  await fill(passInputs[1], 'newpass123');
  await fill(passInputs[2], 'different');
  await submit(document.querySelector('.change-password-fields'));
  assert.match(document.querySelector('.change-password-fields .form-error').textContent, /không khớp/);

  await fill(passInputs[2], 'newpass123');
  await submit(document.querySelector('.change-password-fields'));
  assert.equal(document.querySelector('.change-password-fields .form-error'), null);
});
