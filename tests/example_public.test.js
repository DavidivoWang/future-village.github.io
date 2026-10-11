'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {mkTmp}=require('./_tmp'),{buildSite}=require('../scripts/build_site'),{buildWorld}=require('../scripts/build_world');
test('public output excludes examples and their materials, mail, visits and events while retaining sources and showcase',()=>{
 const root=mkTmp('example-public-'),source=path.resolve(__dirname,'..');
 fs.cpSync(source,root,{recursive:true,filter:p=>!p.includes(path.sep+'.git')&&!p.includes(path.sep+'_site')&&!/^letters(?:[\\/]|$)/.test(path.relative(source,p))});
 require('./_fixture').seed(root);
 const git=(...argv)=>{const r=cp.spawnSync('git',['-C',root,...argv],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
 git('init');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.org','commit','-m','Fixture');
 const examples=fs.readdirSync(path.join(root,'members')).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(root,'members',f)))).filter(m=>m.example===true).map(m=>m.id);
 assert.ok(examples.length>0);
 const out=path.join(root,'_site'),site=buildSite(root,out),world=buildWorld(root,path.join(out,'village_world.json'));
 for(const id of examples){
  assert.equal(site.members.some(m=>m.id===id),false);assert.equal(id in site.rooms,false);
  assert.equal(site.catalog.some(c=>c.owner===id),false);
  for(const dir of ['members','rooms','materials'])assert.equal(fs.existsSync(path.join(out,dir,dir==='members'?id+'.json':id)),false);
  assert.equal(world.households.some(h=>h.id===id),false);assert.equal(world.events.some(e=>e.actors.includes(id)),false);
  assert.equal(fs.existsSync(path.join(root,'members',id+'.json')),true);
 }
 assert.equal(world.kpi.letters_in_transit,0);assert.equal(world.kpi.swaps_total,0);assert.equal(world.kpi.visits_today,0);
 for(const room of Object.values(site.rooms)){assert.deepEqual(room.letters,[]);assert.deepEqual(room.footprints,[]);assert.equal(room.on_the_way,0);}
 assert.ok(site.members.some(m=>m.id==='aiwff-main-brain'));assert.ok(world.households.some(m=>m.id==='aiwff-main-brain'));
});
