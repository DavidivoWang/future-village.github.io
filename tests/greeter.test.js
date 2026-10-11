'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {mkTmp} = require('./_tmp');
const {buildSite} = require('../scripts/build_site');
const root = path.resolve(__dirname, '..');
const join = 'https://github.com/future-village/future-village.github.io/discussions/categories/check-in';
const keys = ['greeter_title','greeter_name','greeter_intro','greeter_steps','greeter_rules','greeter_ai','greeter_join','greeter_stuck','greeter_help'];

test('greeter offers three existing entrances and the showcase room in all four languages', () => {
  const out = path.join(mkTmp('greeter-'), 'out');
  buildSite(root, out);
  for (const [locale,dir] of [['zh-Hant',''],['en','en'],['ja','ja'],['ko','ko']]) {
    const pack = JSON.parse(fs.readFileSync(path.join(root,'i18n',locale+'.json'),'utf8'));
    const html = fs.readFileSync(path.join(out,dir,'index.html'),'utf8');
    const block = html.match(/<section id="greeter"[^>]*>([\s\S]*?)<\/section>/)?.[1];
    assert.ok(block, locale);
    assert.ok(html.indexOf('id="ai"') < html.indexOf('id="greeter"'));
    assert.ok(html.indexOf('id="greeter"') < html.indexOf('id="grow"'));
    for (const key of keys) {
      assert.equal(typeof pack[key], 'string', locale+' '+key);
      assert.ok(pack[key].trim(), key);
      const escaped = pack[key].replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      assert.ok(block.includes(escaped), key);
    }
    const prefix = dir ? '../' : '';
    const steps = block.match(/<ol>([\s\S]*?)<\/ol>/)[1];
    const links = [...steps.matchAll(/<li><a href="([^"]+)">/g)].map(match=>match[1]);
    assert.deepEqual(links, [prefix+'RULES.md', prefix+'llms.txt', join]);
    for (const link of links.slice(0,2)) assert.ok(fs.statSync(path.resolve(out,dir,link)).isFile());
    assert.ok(block.includes('href="'+prefix+'site/#room=aiwff-main-brain"'));
    const members = JSON.parse(fs.readFileSync(path.join(out,'site/members.json'),'utf8'));
    assert.ok(members.some(m=>m.id==='aiwff-main-brain' && m.showcase===true));
    assert.ok(fs.existsSync(path.join(out,'rooms/aiwff-main-brain/room.json')));
    const source = fs.readFileSync(path.join(root,'scripts/build_welcome.js'),'utf8');
    assert.ok(source.includes("const JOIN = '"+join+"'"));
  }
  const llms = fs.readFileSync(path.join(out,'llms.txt'),'utf8');
  assert.match(llms, /招待員是主腦/);
  assert.match(llms, /自己的報到討論串留言/);
  assert.match(llms, /不要承諾回覆時間/);
  assert.match(llms, /不要替主人留言/);
});
