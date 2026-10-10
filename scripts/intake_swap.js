'use strict';
const fs=require('node:fs'),path=require('node:path');
const {checkMember,SLUG,taipeiToday}=require('./check_members');
const LABELS={'我的 slug':'mine','對方 slug':'theirs','我的素材 id':'my_material','對方的素材 id':'their_material','提案日':'date','誰在提案':'drafter','主人同意':'consent'};
// 沒有可換的素材時只回這一句；代收不替人造素材，也不改報到貼文。
const NO_MATERIAL='缺少可互換的素材｜請編輯自己的報到貼文，補一件 SVG。不要另開互換。';
// 代收只寫提案。兩邊同意必須由對方自己另提一次，不從留言代勾。
function guardOneSided(swap){if(swap.a_ok===true&&swap.b_ok===true)throw new Error('代收不得一次寫出兩邊同意');return swap;}
function materialIssue(base,ref,owner){
 if(typeof ref!=='string'||!ref.startsWith(owner+'/'))return '素材 id 須在自己的目錄';
 const id=ref.slice(owner.length+1);
 if(!SLUG.test(id))return '素材 id 格式不符';
 const dir=path.join(base,'materials',owner);
 if(!fs.existsSync(path.join(dir,id+'.svg'))||!fs.existsSync(path.join(dir,id+'.json')))return NO_MATERIAL;
 let meta;try{meta=JSON.parse(fs.readFileSync(path.join(dir,id+'.json'),'utf8'));}catch{return NO_MATERIAL;}
 if(meta.rights_ok!==true||meta.desensitized_ok!==true)return NO_MATERIAL;
 return null;
}
function intakeSwap(event,base=path.resolve(__dirname,'..')) {
 if(!['created','edited'].includes(event.action)||event.discussion?.category?.slug!=='swaps')return {ok:true,skipped:true};
 const post=event.discussion.body;
 const reject=(...errors)=>({ok:false,errors:[...new Set(errors)]});
 if(typeof post!=='string'||post.length>20000)return reject('內文格式或長度不符');
 const sensitive=checkMember({type:'person',handle:'check',avatar:1,intro:post,owner_consent:true}).filter(i=>i.fatal).map(i=>i.kind);
 if(sensitive.length)return reject(...sensitive);
 const fields={},parts=post.split(/^###\s+(.+)\r?$/m);
 for(let i=1;i<parts.length;i+=2){const key=LABELS[parts[i].trim()];if(key){if(Object.hasOwn(fields,key))return reject('重複欄位');fields[key]=parts[i+1].trim();}}
 if(!/^- \[[xX]\] 主人同意提出這筆互換。我沒有代替對方勾同意。$/m.test(fields.consent||''))return reject('缺少主人同意');
 const {mine,theirs,date,drafter}=fields;
 if(!SLUG.test(mine||'')||!SLUG.test(theirs||'')||mine===theirs)return reject('互換須是兩個不同的成員');
 const login=event.discussion.user?.login;
 if(typeof login!=='string'||event.sender?.login?.toLowerCase()!==login.toLowerCase())return reject('只有本人帳號可以提互換');
 if(!['人提出','AI 提案'].includes(drafter))return reject('drafted_by 缺值或格式不符');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date>taipeiToday())return reject('提案日格式不符或晚於今天');
 const members={};
 for(const slug of [mine,theirs]){
  const target=path.join(base,'members',slug+'.json');
  if(!fs.existsSync(target))return reject('成員不存在');
  const member=JSON.parse(fs.readFileSync(target,'utf8'));
  if(member.example===true||member.draft===true||member.owner_consent!==true)return reject('範例戶、草稿或未同意成員不能互換');
  members[slug]=member;
 }
 if(typeof members[mine].github!=='string'||members[mine].github.toLowerCase()!==login.toLowerCase())return reject('作者帳號與成員 github 不符');
 const material={[mine]:fields.my_material,[theirs]:fields.their_material};
 for(const slug of [mine,theirs]){const why=materialIssue(base,material[slug],slug);if(why)return reject(why);}
 const [a,b]=[mine,theirs].sort();
 const ai=drafter==='AI 提案';
 // 人提出：只有帳號對得上 github 的那一側是 true，另一側維持 false。
 const consented=slug=>!ai&&typeof members[slug].github==='string'&&members[slug].github.toLowerCase()===login.toLowerCase();
 const swap=guardOneSided({a,b,a_material:material[a],b_material:material[b],a_ok:consented(a),b_ok:consented(b),...(ai?{drafted_by:'ai'}:{}),proposed_on:date});
 const rel='swaps/'+a+'__'+b+'.json',dest=path.join(base,rel),dir=path.join(base,'swaps');
 if(fs.existsSync(dest))return reject('這兩戶已經有互換檔，請在原檔的 PR 只改自己那一側');
 if(fs.existsSync(dir))for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){
  const old=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  if(old.proposed_on===date&&[old.a,old.b].some(s=>s===mine||s===theirs))return reject('同一戶同一天只能新提一筆互換');
 }
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dest,JSON.stringify(swap,null,2)+'\n',{flag:'wx'});
 return {ok:true,slug:mine,branch:'swap/'+a+'__'+b,files:[rel],warnings:[],kinds:[]};
}
if(require.main===module){let result;try{result=intakeSwap(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),process.argv[3]?path.resolve(process.argv[3]):undefined);}catch{result={ok:false,errors:['內部處理失敗，請管理員檢查']};}console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;}
module.exports={intakeSwap,guardOneSided,NO_MATERIAL};
