'use strict';
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'..');
const map=s=>s.replaceAll('example-person','fixture-person').replaceAll('example-company','fixture-company');
// Build independent, ordinary residents from the format templates without changing sources.
function seed(dest){
 const copy=(src,out)=>{if(fs.statSync(src).isDirectory()){fs.mkdirSync(out,{recursive:true});for(const n of fs.readdirSync(src))copy(path.join(src,n),path.join(out,map(n)));}else{let text=map(fs.readFileSync(src,'utf8'));if(src.endsWith('.json')){const value=JSON.parse(text);if(value.example===true)value.example=false;text=JSON.stringify(value);}fs.writeFileSync(out,text);}};
 for(const dir of ['members','rooms','materials','swaps','footprints']){fs.mkdirSync(path.join(dest,dir),{recursive:true});for(const name of fs.readdirSync(path.join(source,dir)))if(/^(?:example-person|example-company|aiwff-main-brain)(?:\.|__|$)/.test(name))copy(path.join(source,dir,name),path.join(dest,dir,map(name)));}
 for(const state of ['pending','delivered'])fs.mkdirSync(path.join(dest,'letters',state),{recursive:true});
 const letter={from:'fixture-person',to:'fixture-company',date:'2026-10-08',body:'虛構測試信',ai_written:false};
 fs.writeFileSync(path.join(dest,'letters/pending/fixture-person__fixture-company__2026-10-08.json'),JSON.stringify(letter));
 fs.writeFileSync(path.join(dest,'letters/delivered/fixture-company__fixture-person__2026-10-07.json'),JSON.stringify({...letter,from:'fixture-company',to:'fixture-person',date:'2026-10-07',delivered_on:'2026-10-08'}));
 return dest;
}
function copyRepo(dest){fs.cpSync(source,dest,{recursive:true,filter:p=>!p.includes(path.sep+'.git')&&!p.includes(path.sep+'_site')&&!/^(members|rooms|materials|swaps|letters|footprints)(?:[\\/]|$)/.test(path.relative(source,p))});return seed(dest);}
module.exports={seed,copyRepo};
