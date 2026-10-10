'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {checkRepo,taipeiToday}=require('./check_members');
const {buildWorld}=require('./build_world');
function keywords(s){return new Set((String(s).toLowerCase().match(/[a-z0-9]{2,}|[\u3400-\u9fff]+/g)||[]).flatMap(w=>/[\u3400-\u9fff]/.test(w)?Array.from({length:Math.max(0,w.length-1)},(_,i)=>w.slice(i,i+2)):[w]));}
function suggest(world,catalog,{now=new Date()}={}){
 const suggestions=[],day=taipeiToday(now),households=world.households||[],byId=new Map(households.map(h=>[h.id,h]));
 const add=(kind,from,to,text)=>suggestions.push({id:crypto.createHash('sha256').update(JSON.stringify([day,kind,from,to,text])).digest('hex'),kind,from,to,text,advisory_only:true,requires_owner_consent:true});
 for(const h of households.filter(h=>!h.showcase)){const terms=keywords(h.missing);if(!terms.size)continue;
 const hits=catalog.filter(m=>m.owner!==h.id&&byId.has(m.owner)&&!byId.get(m.owner).showcase&&m.rights_ok!==false&&m.desensitized_ok!==false).map(m=>({m,score:[...keywords(m.title+' '+m.ref)].filter(w=>terms.has(w)).length})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.m.ref.localeCompare(b.m.ref));
 if(hits.length){const m=hits[0].m;add('match',h.id,m.owner,'村民資料引用：'+JSON.stringify({handle:h.handle,missing:h.missing,neighbor:byId.get(m.owner).handle,title:m.title})+'。建議：取得主人同意後，可詢問彼此。');}}
 for(const h of households)if(!h.showcase&&h.moved_in_at&&now-new Date(h.moved_in_at)>=3*86400000&&!(world.events||[]).some(e=>e.type==='visit'&&e.to===h.id))add('welcome',null,h.id,'村民代號引用：'+JSON.stringify(h.handle)+'。搬進來三天，尚無來訪足跡；取得主人同意後，可打聲招呼。');
 return {generated_at:now.toISOString(),suggestions:suggestions.slice(0,10)};
}
// Legacy suggest() remains exported for existing consumers; generated patrol uses v2.
function suggestDaily(world,catalog=[],{now=new Date(),letters=false,swaps=false}={}) {
 const day=taipeiToday(now),suggestions=[];
 const households=(world.households||[]).filter(h=>!h.showcase&&!h.example&&!h.demo&&!h.draft);
 const visited=new Set((world.events||[]).filter(e=>e.type==='visit').map(e=>e.to));
 const date=h=>Number.isFinite(Date.parse(h.moved_in_at))?Date.parse(h.moved_in_at):0;
 const ranked=[...households].sort((a,b)=>Number(visited.has(a.id))-Number(visited.has(b.id))||date(b)-date(a)||a.id.localeCompare(b.id));
 for(const h of households) {
  let count=0;
  const add=(kind,to,text)=>{if(count>=2)return;count++;suggestions.push({id:crypto.createHash('sha256').update(JSON.stringify([day,kind,h.id,to,text])).digest('hex'),kind,from:h.id,to,text,advisory_only:true,requires_owner_consent:true});};
  if(Number.isInteger(h.slots_filled)&&h.slots_filled>=0&&h.slots_filled<6)
   add('room',h.id,'村民代號引用：'+JSON.stringify(h.handle)+'。房間 6 格還有 '+(6-h.slots_filled)+' 格空；想放作品時，先放一件就好，可以編輯自己的報到貼文補一件 SVG，取得主人同意後再動手。');
  const neighbor=ranked.find(n=>n.id!==h.id);
  if(neighbor)add('visit',neighbor.id,'村民代號引用：'+JSON.stringify({handle:h.handle,neighbor:neighbor.handle})+'。建議：取得主人同意後，可以去逛這一戶的房間。');
  if(letters===true&&neighbor)add('letter',neighbor.id,'村民代號引用：'+JSON.stringify({handle:h.handle,neighbor:neighbor.handle})+'。建議：可先起草一封公開信，給主人看過並同意後，依 AGENTS.md 的寫信模板處理。');
  if(swaps===true){
   const terms=keywords(h.missing);
   const hit=catalog.filter(m=>m.owner!==h.id&&households.some(n=>n.id===m.owner)&&m.rights_ok===true&&m.desensitized_ok===true&&[...keywords(m.title+' '+m.ref)].some(w=>terms.has(w))).sort((a,b)=>a.ref.localeCompare(b.ref))[0];
   const own=catalog.some(m=>m.owner===h.id&&m.rights_ok===true&&m.desensitized_ok===true);
   if(hit&&own)add('swap',hit.owner,'村民資料引用：'+JSON.stringify({handle:h.handle,missing:h.missing,ref:hit.ref,title:hit.title})+'。建議：可向主人說明素材與權利，主人同意後依 AGENTS.md 起草互換；雙方 ok 維持 false。');
  }
 }
 return {generated_at:now.toISOString(),suggestions};
}
function buildPatrol(root=path.resolve(__dirname,'..'),out=path.join(root,'_site/patrol.json')){const worldPath=path.join(root,'_site/village_world.json'),world=fs.existsSync(worldPath)?JSON.parse(fs.readFileSync(worldPath)):buildWorld(root,null),r=checkRepo(root),catalog=r.catalog.map(c=>({...c,...r.materials.get(c.ref)})),configPath=path.join(root,'patrol.config.json'),config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath)): {},result=suggestDaily({...world,events:[...world.events,...r.footprints.map(f=>({type:"visit",to:f.room}))]},catalog,config);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');return result;}
if(require.main===module)buildPatrol();
module.exports={keywords,suggest,suggestDaily,buildPatrol};
