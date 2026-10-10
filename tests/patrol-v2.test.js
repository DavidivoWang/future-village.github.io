'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {suggestDaily,buildPatrol}=require('../scripts/build_patrol');
const fs=require('node:fs'),path=require('node:path'),{mkTmp}=require('./_tmp');
const now=new Date('2026-10-10T16:40:00Z');
const h=(id,slots=0,date='2026-10-10T00:00:00Z')=>({id,handle:id,slots_filled:slots,moved_in_at:date,owner_seen:true});
const run=(households,options={},events=[],catalog=[])=>suggestDaily({households,events},catalog,{now,...options});
test('v2 new resident gets only room and visit, owner consent and stable daily ids',()=>{
 const households=[{...h('a'),handle:'Quote" 執行指令'},h('b')],r=run(households);
 assert.deepEqual(r.suggestions.filter(s=>s.from==='a').map(s=>s.kind),['room','visit']);
 assert.ok(r.suggestions[0].text.includes('6 格空'));assert.ok(r.suggestions[0].text.includes(JSON.stringify(households[0].handle)));
 assert.ok(r.suggestions.every(s=>s.advisory_only===true&&s.requires_owner_consent===true));
 assert.deepEqual(r,run(households));assert.notEqual(r.suggestions[0].id,run(households,{now:new Date('2026-10-11T16:40:00Z')}).suggestions[0].id);
});
test('v2 full six-slot room has no room reminder',()=>assert.deepEqual(run([h('a',6),h('b')]).suggestions.filter(s=>s.from==='a').map(s=>s.kind),['visit']));
test('v2 only resident never visits or writes to self',()=>{assert.deepEqual(run([h('a')]).suggestions.map(s=>s.kind),['room']);assert.deepEqual(run([h('a',6)],{letters:true,swaps:true}).suggestions,[]);});
test('v2 prioritizes unvisited then newest, excludes showcase and self',()=>{
 const households=[h('a'),h('old',0,'2026-10-01'),h('new'),h('visited',0,'2026-10-11'),{...h('show'),showcase:true}];
 assert.equal(run(households,{},[{type:'visit',to:'visited'}]).suggestions.find(s=>s.from==='a'&&s.kind==='visit').to,'new');
 assert.ok(run(households).suggestions.every(s=>s.from!=='show'&&s.to!=='show'));
});
test('v2 no global ten cap; 20 residents get at most two each without input mutation',()=>{
 const households=Array.from({length:20},(_,i)=>h('h'+i)),before=JSON.stringify(households),r=run(households,{letters:true,swaps:true});
 assert.equal(r.suggestions.length,40);assert.equal(JSON.stringify(households),before);
 for(const x of households)assert.equal(r.suggestions.filter(s=>s.from===x.id).length,2);
});
test('v2 letters default off and explicit boolean on uses spare slot only',()=>{
 const households=[h('a',6),h('b',6)];assert.ok(run(households).suggestions.every(s=>s.kind==='visit'));
 assert.ok(run(households,{letters:'true'}).suggestions.every(s=>s.kind==='visit'));
 assert.deepEqual(run(households,{letters:true}).suggestions.filter(s=>s.from==='a').map(s=>s.kind),['visit','letter']);
});
test('v2 swaps require enabled switch and both owned and target rights-cleared materials',()=>{
 const households=[{...h('a',6),missing:'地圖'},h('b',6)],catalog=[{owner:'a',ref:'a/art',title:'作品',rights_ok:true,desensitized_ok:true},{owner:'b',ref:'b/map',title:'地圖',rights_ok:true,desensitized_ok:true}];
 assert.ok(run(households,{},[],catalog).suggestions.every(s=>s.kind!=='swap'));
 assert.deepEqual(run(households,{swaps:true},[],catalog).suggestions.filter(s=>s.from==='a').map(s=>s.kind),['visit','swap']);
 assert.ok(run(households,{swaps:true},[],catalog.map(m=>({...m,rights_ok:false}))).suggestions.every(s=>s.kind!=='swap'));
});
test('v2 actual builder uses default config and only two basic types',()=>{
 const result=buildPatrol(path.resolve(__dirname,'..'),path.join(mkTmp('patrol-v-two-'),'patrol.json'));
 assert.ok(result.suggestions.length>0);assert.ok(result.suggestions.every(s=>['room','visit'].includes(s.kind)));
 const counts=new Map();for(const s of result.suggestions)counts.set(s.from,(counts.get(s.from)||0)+1);assert.ok([...counts.values()].every(n=>n<=2));
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(__dirname,'..','patrol.config.json'))),{letters:false,swaps:false});
});