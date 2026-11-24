import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Screen Share & Reply features integration check in source code', () => {
  const appPath = path.resolve(process.cwd(), 'ptitchat/src/App.jsx');
  const code = fs.readFileSync(appPath, 'utf8');

  // Check Reply imports and components
  assert.ok(code.includes('Reply'), 'App.jsx must import Reply icon from lucide-react');
  assert.ok(code.includes('ScreenShare'), 'App.jsx must import ScreenShare icon from lucide-react');
  assert.ok(code.includes('replyingTo'), 'App.jsx must have replyingTo state');
  assert.ok(code.includes('isScreenSharing'), 'App.jsx must have isScreenSharing state');

  // Check UI Elements
  assert.ok(code.includes('title="Trả lời tin nhắn"'), 'Must have Reply button in message hover menu');
  assert.ok(code.includes('reply-preview-bar'), 'Must render reply preview bar above composer');
  assert.ok(code.includes('reply-quote-box'), 'Must render reply quote box inside message bubble');
  assert.ok(code.includes('active-share'), 'Must support active-share class for screen share button');
  assert.ok(code.includes('toggleScreenShare'), 'Must implement toggleScreenShare handler');

  // Check styles
  const cssPath = path.resolve(process.cwd(), 'ptitchat/src/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.includes('.reply-preview-bar'), 'styles.css must style .reply-preview-bar');
  assert.ok(css.includes('.reply-quote-box'), 'styles.css must style .reply-quote-box');
  assert.ok(css.includes('.call-action-btn.active-share'), 'styles.css must style .call-action-btn.active-share');
});
