// Brand and UX round (19 Nov): one colour language, one card, hero untouched, calm motion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (f) => readFile(new URL(f, import.meta.url), 'utf8');
const css = await read('../assets/styles.css');
const block = css.slice(css.indexOf('/* ===== S4 final direction (19 Nov)'));

const lum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test('colour tokens: teal = automation, violet = AI, amber = a person decides', () => {
  assert.ok(block.length > 1000, 'S4 block exists');
  for (const t of ['--ai: #6a4fc0', '--ai-on-dark: #c9b8f2', '--teal-tint: #e8f3ef', '--human-dark: #8a5200', '--radius-card: 14px', '--shadow-card:']) assert.ok(block.includes(t), t);
  assert.doesNotMatch(css, /#6b4fbb|#b9a8f0/i, 'one violet only');
  assert.doesNotMatch(css, /built-card-ai \{ border-top-color: var\(--signal\)|#7a5b16; \}/, 'no gold AI left over');
  assert.match(block, /\.rr-d-ai \{ --c: var\(--ai-on-dark\); \}/);
  assert.match(block, /\.built-card\.built-card-ai \{ border-top-color: var\(--ai\); \}/);
});

test('contrast: every text pair in the colour system meets WCAG AA', () => {
  assert.ok(ratio('#6a4fc0', '#ffffff') >= 4.5, 'AI on white');
  assert.ok(ratio('#4b3696', '#f1edfb') >= 4.5, 'AI text on AI tint');
  assert.ok(ratio('#c9b8f2', '#0f3a3a') >= 4.5, 'AI on dark band');
  assert.ok(ratio('#ffffff', '#8a5200') >= 4.5, 'white on amber badge');
  assert.ok(ratio('#f0a75a', '#0f3a3a') >= 4.5, 'amber on dark band');
  assert.ok(ratio('#24655c', '#e8f3ef') >= 4.5, 'teal text on teal tint');
  assert.ok(ratio('#8fd3c3', '#0f3a3a') >= 4.5, 'teal on dark band');
});

test('the locked hero is untouched by the round: no hero selectors, no global token overrides', () => {
  assert.doesNotMatch(block, /\.hero|\.rr-hero|\.rx[\s.{-]|\.ops-|\.hv-|\.hx[\s.{-]/, 'no hero selectors');
  assert.doesNotMatch(block, /--info-bg\s*:|--radius\s*:|--shadow\s*:|--accent\s*:/, 'shared tokens unchanged');
  assert.doesNotMatch(block, /!important/);
});

test('"One request, step by step" shows the roles: AI violet, automatic check teal, person amber; no shake', () => {
  assert.match(block, /#services \.rf \[data-rf="2"\] \.rf-n \{ background: var\(--ai\); \}/);
  assert.match(block, /#services \.rf \.rf-flag \.rf-n \{ background: var\(--teal\); \}/);
  assert.match(block, /#services \.rf \.rf-ok \.rf-n \{ background: var\(--human-dark\); \}/);
  assert.doesNotMatch(css, /rf-nudge/);
});

test('safety: one connected panel; the human safeguard is amber', () => {
  assert.match(block, /\.sn-section \.sn-list \{ gap: 1px;[^}]*border-radius: var\(--radius-card\)/);
  assert.match(block, /li\.sn-human \.sn-n \{ background: var\(--human-dark\); \}/);
});

test('calm motion: no overshoot, no hover lift, dead drill flash removed', () => {
  assert.doesNotMatch(css, /cubic-bezier\(0\.3, 1\.4/);
  assert.doesNotMatch(css, /sn-flash/);
  assert.doesNotMatch(block, /translateY\(-/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('page structure unchanged by the visual round: no inline styles, nine sections', async () => {
  const html = await read('../index.html');
  assert.doesNotMatch(html, /\sstyle="/);
  assert.equal((html.match(/<section /g) || []).length, 9);
});
