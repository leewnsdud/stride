import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Markdown from '../src/Markdown.mjs';
const render = text => renderToStaticMarkup(React.createElement(Markdown, null, text));
test('Markdown renders headings, emphasis, nested lists, GFM tables and code', () => {
  const html=render('## 훈련 요약\n\n**목표**와 *회복*\n\n- 첫째\n  - 다음\n\n| 구간 | 시간 |\n| --- | --- |\n| 1 | 0:10:00 |\n\n> 참고\n\n```txt\n<raw>\n```\n\n- [x] 완료');
  for(const fragment of ['<h2>훈련 요약</h2>','<strong>목표</strong>','<em>회복</em>','<ul>','<table>','<th>구간</th>','<blockquote>','<pre>','&lt;raw&gt;','type="checkbox"']) assert.ok(html.includes(fragment),fragment);
});
test('Markdown never executes HTML, unsafe links or auto-loads remote images', () => {
  const html=render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29)\n\n![tracking](https://example.com/pixel.png)\n\n[good](https://example.com)');
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('src='));
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});
test('Korean suffixes after punctuation preserve emphasis without changing code or escapes', () => {
  const html=render('약 **87%**였습니다. ~~취소(안)~~입니다.\n\n`**87%**`\n\n\\*\\*원문\\*\\*');
  assert.ok(html.includes('<strong>87%</strong>였습니다.'));
  assert.ok(html.includes('<del>취소(안)</del>입니다.'));
  assert.ok(html.includes('<code>**87%**</code>'));
  assert.ok(html.includes('**원문**'));
});
