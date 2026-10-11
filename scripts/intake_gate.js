'use strict';
const fs=require('node:fs');
function intakeBranch(event,login){
 const category=event.discussion?.category?.slug;
 if(category==='check-in')return 'intake/'+login.toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/^-+|-+$/g,'').slice(0,39);
 const fields={},parts=(event.discussion?.body||'').split(/^###\s+(.+)\r?$/m);
 for(let i=1;i<parts.length;i+=2){const key=parts[i].trim();if(Object.hasOwn(fields,key))return null;fields[key]=parts[i+1].trim();}
 const valid=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,40}$/.test(value);
 if(category==='letters'&&valid(fields['寄件 slug'])&&valid(fields['收件 slug'])&&/^\d{4}-\d{2}-\d{2}$/.test(fields['寄出日']||''))return 'letter/'+fields['寄件 slug']+'__'+fields['收件 slug']+'__'+fields['寄出日'];
 if(category==='swaps'&&valid(fields['我的 slug'])&&valid(fields['對方 slug']))return 'swap/'+[fields['我的 slug'],fields['對方 slug']].sort().join('__');
 return null;
}
function gate(user,prs,event,now=Date.now()) {
 const created=Date.parse(user.created_at);
 if(!Number.isFinite(created)||now-created<7*86400000)return {ok:false,message:'帳號建立未滿 7 天或建立時間無法確認，請滿 7 天後再報到；尚未開 PR。'};
 const login=event.discussion?.user?.login;
 if(typeof login!=='string')return {ok:false,message:'無法確認報到帳號。'};
 const branch=intakeBranch(event,login);
 const intake=prs.filter(p=>/^(intake|letter|swap)\//.test(p.headRefName));
 if(intake.length>50&&!intake.some(p=>p.headRefName===branch))return {ok:false,message:'排隊中：開著的 intake PR 超過 50 條，暫不開新的 PR。'};
 return {ok:true,message:'可以代收'};
}
if(require.main===module){const [user,prs,event]=process.argv.slice(2).map(p=>JSON.parse(fs.readFileSync(p,'utf8')));const r=gate(user,prs,event);console.log(r.message);if(!r.ok)process.exitCode=1;}
module.exports={gate,intakeBranch};
