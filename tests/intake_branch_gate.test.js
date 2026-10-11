'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {gate,intakeBranch}=require('../scripts/intake_gate');
const user={created_at:'2020-01-01'};
const full=Array.from({length:51},(_,i)=>({headRefName:'intake/queued-'+i}));
function event(category,fields){return {discussion:{user:{login:'Alice'},category:{slug:category},body:Object.entries(fields).map(([k,v])=>'### '+k+'\n\n'+v+'\n').join('\n')}};}
for(const [category,fields,branch] of [
 ['letters',{'寄件 slug':'alice','收件 slug':'bob','寄出日':'2026-10-11'},'letter/alice__bob__2026-10-11'],
 ['swaps',{'我的 slug':'bob','對方 slug':'alice'},'swap/alice__bob']
])test(category+' existing exact branch can update when quota is exceeded',()=>{
 const e=event(category,fields);assert.equal(intakeBranch(e,'Alice'),branch);
 assert.equal(gate(user,full,e).ok,false);
 assert.equal(gate(user,[...full,{headRefName:branch}],e).ok,true);
 assert.equal(gate(user,[...full,{headRefName:(category==='letters'?'letter/':'swap/')+'alice'}],e).ok,false);
 assert.equal(gate(user,full.slice(1),e).ok,true);
});
test('invalid and duplicate fields do not bypass queue',()=>{
 const e=event('swaps',{'我的 slug':'../alice','對方 slug':'bob'});
 assert.equal(intakeBranch(e,'Alice'),null);assert.equal(gate(user,full,e).ok,false);
 e.discussion.body='### 我的 slug\n\nalice\n\n### 我的 slug\n\nalice\n\n### 對方 slug\n\nbob';
 assert.equal(intakeBranch(e,'Alice'),null);
});
