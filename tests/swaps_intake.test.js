'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {intakeSwap,NO_MATERIAL}=require('../scripts/intake_swap');
const {sweep,receive}=require('../scripts/intake_sweep');
const {taipeiToday}=require('../scripts/check_members');
// Retain small task-owned fixtures on D:; never recursively remove directories.
function member(base,slug,github=slug,extra={}){fs.mkdirSync(path.join(base,'members'),{recursive:true});fs.writeFileSync(path.join(base,'members',slug+'.json'),JSON.stringify({type:'person',handle:slug,avatar:1,intro:'hello',github,owner_consent:true,...extra}));}
function material(base,slug,id='item-1',meta={}){const dir=path.join(base,'materials',slug);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,id+'.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>');fs.writeFileSync(path.join(dir,id+'.json'),JSON.stringify({title:'t',source:'s',rights_ok:true,desensitized_ok:true,made_by:'human',...meta}));}
function fixture(){const base=fs.mkdtempSync(path.resolve(__dirname,'../../fv-swap-fixture-'));for(const slug of ['alice','bob','carol']){member(base,slug);material(base,slug);}return base;}
function post(overrides={}){const fields={'我的 slug':'alice','對方 slug':'bob','我的素材 id':'alice/item-1','對方的素材 id':'bob/item-1','提案日':taipeiToday(),'誰在提案':'AI 提案','主人同意':'- [x] 主人同意提出這筆互換。我沒有代替對方勾同意。',...overrides};return Object.entries(fields).map(([k,v])=>'### '+k+'\n\n'+v+'\n').join('\n');}
function event(overrides={}){return {action:'created',sender:{login:'alice'},discussion:{user:{login:'alice',id:1},category:{slug:'swaps'},body:post(overrides)}};}
function listSwaps(base){const dir=path.join(base,'swaps');return fs.existsSync(dir)?fs.readdirSync(dir):[];}
function rejected(overrides,kind,prepared){const base=prepared||fixture(),before=listSwaps(base),r=intakeSwap(event(overrides),base);assert.equal(r.ok,false);if(kind)assert.ok(r.errors.includes(kind),JSON.stringify(r));assert.deepEqual(listSwaps(base),before);return r;}

test('AI 提案兩邊都是 false，並寫 drafted_by 為 ai',()=>{
 const base=fixture(),r=intakeSwap(event(),base);
 assert.equal(r.ok,true);
 assert.equal(r.files[0],'swaps/alice__bob.json');
 assert.equal(r.branch,'swap/alice__bob');
 const s=JSON.parse(fs.readFileSync(path.join(base,r.files[0])));
 assert.deepEqual(Object.keys(s),['a','b','a_material','b_material','a_ok','b_ok','drafted_by','proposed_on']);
 assert.deepEqual(s,{a:'alice',b:'bob',a_material:'alice/item-1',b_material:'bob/item-1',a_ok:false,b_ok:false,drafted_by:'ai',proposed_on:taipeiToday()});
});

test('人提出只有貼文作者那一側是 true，不寫 drafted_by',()=>{
 const base=fixture(),r=intakeSwap(event({'誰在提案':'人提出'}),base);
 assert.equal(r.ok,true);
 const s=JSON.parse(fs.readFileSync(path.join(base,r.files[0])));
 assert.equal(s.a,'alice');assert.equal(s.a_ok,true);assert.equal(s.b_ok,false);
 assert.equal(Object.hasOwn(s,'drafted_by'),false);
});

test('作者 slug 排在後面時，仍只有作者那一側是 true',()=>{
 const base=fixture();
 const e=event({'我的 slug':'bob','對方 slug':'alice','我的素材 id':'bob/item-1','對方的素材 id':'alice/item-1','誰在提案':'人提出'});
 e.sender.login='bob';e.discussion.user.login='bob';
 const r=intakeSwap(e,base);assert.equal(r.ok,true);
 const s=JSON.parse(fs.readFileSync(path.join(base,r.files[0])));
 assert.equal(s.a,'alice');assert.equal(s.a_ok,false);assert.equal(s.b_ok,true);
});

test('作者帳號對不上成員 github 就退，目錄沒有新檔',()=>{
 const base=fixture(),before=listSwaps(base),e=event();
 e.sender.login='intruder';e.discussion.user.login='intruder';
 const r=intakeSwap(e,base);
 assert.equal(r.ok,false);
 assert.ok(r.errors.includes('作者帳號與成員 github 不符'),JSON.stringify(r));
 assert.deepEqual(listSwaps(base),before);
});

test('對方是範例戶就退',()=>{
 const base=fixture();
 fs.writeFileSync(path.join(base,'members/bob.json'),JSON.stringify({type:'person',handle:'bob',avatar:1,intro:'hello',github:'bob',owner_consent:true,example:true}));
 rejected({},'範例戶、草稿或未同意成員不能互換',base);
});

test('自己沒有素材就退，留言是固定句',()=>{
 const base=fixture();
 fs.rmSync(path.join(base,'materials/alice/item-1.svg'));
 const r=rejected({},NO_MATERIAL,base);
 assert.deepEqual(r.errors,[NO_MATERIAL]);
 assert.equal('失敗｜'+r.errors.join('\n失敗｜'),'失敗｜缺少可互換的素材｜請編輯自己的報到貼文，補一件 SVG。不要另開互換。');
});

test('對方沒有素材、權利或去敏不是 true 都走同一句',()=>{
 const noTheirs=fixture();fs.rmSync(path.join(noTheirs,'materials/bob/item-1.json'));
 assert.deepEqual(rejected({},NO_MATERIAL,noTheirs).errors,[NO_MATERIAL]);
 for(const flag of ['rights_ok','desensitized_ok']){
  const base=fixture();material(base,'alice','item-1',{[flag]:false});
  assert.deepEqual(rejected({},NO_MATERIAL,base).errors,[NO_MATERIAL]);
 }
});

test('兩邊都會是 true 時直接停，不寫檔',()=>{
 const base=fixture();
 member(base,'alice-two','alice');material(base,'alice-two');
 const before=listSwaps(base);
 assert.throws(()=>intakeSwap(event({'對方 slug':'alice-two','對方的素材 id':'alice-two/item-1','誰在提案':'人提出'}),base),/兩邊同意/);
 assert.deepEqual(listSwaps(base),before);
});

test('同一戶同一天第二筆提案失敗，目錄沒有新檔',()=>{
 const base=fixture();
 assert.equal(intakeSwap(event(),base).ok,true);
 const before=listSwaps(base);
 const r=intakeSwap(event({'對方 slug':'carol','對方的素材 id':'carol/item-1'}),base);
 assert.equal(r.ok,false);
 assert.ok(r.errors.includes('同一戶同一天只能新提一筆互換'),JSON.stringify(r));
 assert.deepEqual(listSwaps(base),before);
});

test('同一組已經有互換檔時不覆蓋',()=>{
 const base=fixture();
 assert.equal(intakeSwap(event(),base).ok,true);
 const kept=fs.readFileSync(path.join(base,'swaps/alice__bob.json'),'utf8');
 const r=intakeSwap(event({'提案日':'2026-01-01'}),base);
 assert.equal(r.ok,false);
 assert.equal(fs.readFileSync(path.join(base,'swaps/alice__bob.json'),'utf8'),kept);
});

test('缺主人同意、提案日晚於今天、誰在提案缺值都退',()=>{
 rejected({'主人同意':'- [ ] 主人同意提出這筆互換。我沒有代替對方勾同意。'},'缺少主人同意');
 rejected({'提案日':'2099-12-31'},'提案日格式不符或晚於今天');
 rejected({'提案日':'2026-02-30'},'提案日格式不符或晚於今天');
 rejected({'誰在提案':'_No response_'},'drafted_by 缺值或格式不符');
 rejected({'對方 slug':'alice','對方的素材 id':'alice/item-1'},'互換須是兩個不同的成員');
 rejected({'我的素材 id':'bob/item-1'},'素材 id 須在自己的目錄');
});

for(const [kind,value] of [['台灣手機','0912345678'],['Email','private@example.com'],['金鑰','sk-abcdefghijklmnopqrstuvwxyz1234567890']])
 test('互換貼文夾帶'+kind+'只回種類，不寫檔',()=>{const r=rejected({'我的素材 id':'alice/item-1\n'+value},kind);assert.ok(r.errors.every(e=>!e.includes(value)));});

test('swaps 分類不存在時零動作、零留言',async()=>{
 const base=fixture(),before=listSwaps(base),e=event();
 delete e.discussion.category;
 assert.deepEqual(intakeSwap(e,base),{ok:true,skipped:true});
 const other={...e,discussion:{...e.discussion,category:{slug:'check-in'}}};
 assert.deepEqual(intakeSwap(other,base),{ok:true,skipped:true});
 let calls=0;
 assert.deepEqual(await sweep(()=>({nodes:[{author:{login:'alice'},category:{slug:'check-in'}}].filter(d=>d.category.slug==='swaps'),pageInfo:{hasNextPage:false}}),()=>{calls++;},()=>{calls++;}),[]);
 assert.equal(calls,0);
 assert.deepEqual(receive({category:{slug:'unknown'}},'',[],{run(){calls++;}}),{ok:true,skipped:true});
 assert.equal(calls,0);
 assert.deepEqual(listSwaps(base),before);
});

test('端到端：互換貼文經代收寫出提案檔與 PR 參數，只 stage 那一個檔',async()=>{
 const tempRoot=fixture(),calls=[],comments=[];let base,staged;
 const d={id:'D_swap',number:7,author:{login:'alice',databaseId:1},category:{slug:'swaps'},body:post({'誰在提案':'人提出'})};
 const io={tempRoot,run(command,argv,cwd){calls.push([command,...argv]);if(command===process.execPath)return '';
  if(argv[0]==='worktree'){base=argv[3];for(const slug of ['alice','bob']){member(base,slug);material(base,slug);}}
  if(argv[0]==='add')staged=argv.slice(2).join('\n');
  if(argv[0]==='diff')return staged;
  return '';},
  spawnSync(executable,argv,options){assert.equal(argv[0],'scripts/intake_swap.js');return {status:0,stdout:JSON.stringify(intakeSwap(JSON.parse(fs.readFileSync(argv[1])),options.cwd))};},
  gh(argv){calls.push(['gh',...argv]);if(argv[0]==='api')return JSON.stringify({created_at:'2020-01-01'});if(argv[1]==='list')return '';if(argv[1]==='create')return 'https://github.com/example/repo/pull/7';return '';},
  graphql(query,vars){comments.push(vars.body);return {};}};
 const results=await sweep(()=>({nodes:[d],pageInfo:{hasNextPage:false}}),()=>false,(discussion,mark)=>receive(discussion,mark,[],io));
 assert.equal(results[0].ok,true);
 assert.deepEqual(listSwaps(base),['alice__bob.json']);
 assert.equal(staged,'swaps/alice__bob.json');
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(base,staged))),{a:'alice',b:'bob',a_material:'alice/item-1',b_material:'bob/item-1',a_ok:true,b_ok:false,proposed_on:taipeiToday()});
 const create=calls.find(c=>c[0]==='gh'&&c[2]==='create');
 assert.ok(create);
 assert.equal(create[create.indexOf('--head')+1],'swap/alice__bob');
 assert.equal(create[create.indexOf('--base')+1],'main');
 assert.equal(create[create.indexOf('--title')+1],'Swap: alice');
 const commit=calls.find(c=>c[0]==='git'&&c.includes('commit'));
 assert.equal(commit[commit.indexOf('-m')+1],'Receive swap');
 assert.ok(comments.some(c=>c.includes('PR: ')));
 assert.equal(comments.length,2);
});
