'use strict';
const fs=require('node:fs'),path=require('node:path');
const {checkMember,SLUG,LETTER_MAX,taipeiToday}=require('./check_members');
const {EXTERNAL}=require('./intake');
const LABELS={'寄件 slug':'from','收件 slug':'to','寄出日':'date','內文':'body','誰寫的':'writer','主人同意':'consent'};
function intakeLetter(event,base=path.resolve(__dirname,'..')) {
 if(!['created','edited'].includes(event.action)||event.discussion?.category?.slug!=='letters')return {ok:true,skipped:true};
 const post=event.discussion.body;
 const reject=(...errors)=>({ok:false,errors:[...new Set(errors)]});
 if(typeof post!=='string'||post.length>20000)return reject('內文格式或長度不符');
 const sensitive=checkMember({type:'person',handle:'check',avatar:1,intro:post,owner_consent:true}).filter(i=>i.fatal).map(i=>i.kind);
 if(sensitive.length)return reject(...sensitive);
 const fields={},parts=post.split(/^###\s+(.+)\r?$/m);
 for(let i=1;i<parts.length;i+=2){const key=LABELS[parts[i].trim()];if(key){if(Object.hasOwn(fields,key))return reject('重複欄位');fields[key]=parts[i+1].trim();}}
 if(!/^- \[[xX]\] 主人看過這封信，同意公開在 repo，並同意請維護者寫進信件檔。$/m.test(fields.consent||''))return reject('缺少主人同意');
 const {from,to,date,body,writer}=fields;
 if(!SLUG.test(from||'')||!SLUG.test(to||'')||from===to)return reject('寄件人與收件人須是兩個不同的成員');
 const login=event.discussion.user?.login;
 if(typeof login!=='string'||event.sender?.login?.toLowerCase()!==login.toLowerCase())return reject('只有本人帳號可以寄信');
 for(const slug of [from,to]){
  const target=path.join(base,'members',slug+'.json');
  if(!fs.existsSync(target))return reject('成員不存在');
  const member=JSON.parse(fs.readFileSync(target,'utf8'));
  if(member.example===true||member.draft===true||member.owner_consent!==true)return reject('範例戶、草稿或未同意成員不能寄收信');
  if(slug===from&&(typeof member.github!=='string'||member.github.toLowerCase()!==login.toLowerCase()))return reject('作者帳號與成員 github 不符');
 }
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date>taipeiToday())return reject('寄出日格式不符或晚於今天');
 if(typeof body!=='string'||!body.trim()||body.length>LETTER_MAX)return reject('信的內容須為 1～'+LETTER_MAX+' 字');
 if(EXTERNAL.test(body))return reject('不收外部連結');
 if(!['AI 起草','人親自寫'].includes(writer))return reject('ai_written 缺值或格式不符');
 for(const box of ['pending','delivered']){
  const dir=path.join(base,'letters',box);if(!fs.existsSync(dir))continue;
  for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){const old=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));if(old.from===from&&old.date===date)return reject('同一個人同一天只能寄一封');}
 }
 const letter={from,to,date,body,ai_written:writer==='AI 起草'};
 const rel='letters/pending/'+from+'__'+to+'__'+date+'.json',dest=path.join(base,rel);
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(letter,null,2)+'\n',{flag:'wx'});
 return {ok:true,slug:from,branch:'letter/'+from+'__'+to+'__'+date,files:[rel],warnings:[],kinds:[]};
}
if(require.main===module){let result;try{result=intakeLetter(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),process.argv[3]?path.resolve(process.argv[3]):undefined);}catch{result={ok:false,errors:['內部處理失敗，請管理員檢查']};}console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;}
module.exports={intakeLetter};
