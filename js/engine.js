/* 가계부 계산 엔진 — 기존 가계부 앱의 계산 로직을 그대로 옮긴 파일이에요.
   화면과 저장소에 의존하지 않고, 아래 전역 상태만 읽고 써요. */
"use strict";
const FIRST_YEAR=2027;
const NOW=(function(){
  const real=new Date();
  const q=(typeof location!=='undefined')?new URLSearchParams(location.search).get('now'):null;
  if(q){const d=new Date(q);if(!isNaN(d)) return d}
  /* 앱을 시작하는 해(FIRST_YEAR) 전에 만들어 보는 동안에는 시작일을 오늘로 대신해요 */
  if(real.getFullYear()<FIRST_YEAR&&typeof window!=='undefined'&&window.DEMO_NOW){const d=new Date(window.DEMO_NOW);if(!isNaN(d)) return d}
  return real;
})();
const S={year:NOW.getFullYear()<FIRST_YEAR?FIRST_YEAR:NOW.getFullYear(),view:NOW.getFullYear()<FIRST_YEAR?1:NOW.getMonth()+1,net:true,optIn:true};
const Hooks={month:function(){},cfg:function(){}};
const TYPES=['out','in','ded','save','settle'];
const TLABEL={in:'수입',out:'지출',ded:'공제',save:'저축',fund:'예비',settle:'정산'};
const OTHER={out:'기타',in:'추가 수입',ded:'기타 공제',save:'기타 저축',settle:'기타 정산'};
const LEGACY_OUT=['식비','잡화','관리비','보험','주유','톨비','오락','의류','미용','기타','의료','출장'];
const MINUS='\u2212';
const M12=[1,2,3,4,5,6,7,8,9,10,11,12];
const AFTER=[
  {id:'방과후수업',name:'방과후(월·화)',h:0},
  {id:'방과후-수',name:'방과후(수)',h:0},
  {id:'방과후-목',name:'방과후(목)',h:0}
];

let MIGRATED=false;
function normCats(o){
  if(!o||typeof o!=='object'||!Array.isArray(o.out)||!Array.isArray(o.in)||!Array.isArray(o.save)) return null;
  const src={out:o.out,in:o.in,save:o.save,ded:o.ded,settle:o.settle};
  if(!Array.isArray(o.ded)){
    MIGRATED=true;
    src.ded=defaultCats().ded;
    const inn=o.in.map(x=>Object.assign({},x));
    const has=id=>inn.some(x=>x&&x.id===id);
    const i=inn.findIndex(x=>x&&x.id==='방과후수업');
    if(i>=0){
      inn[i].name='방과후(월·화)';
      inn.splice(i+1,0,...AFTER.slice(1).filter(a=>!has(a.id)).map(a=>Object.assign({},a)));
    }else{
      let j=inn.findIndex(x=>x&&x.id===OTHER.in);if(j<0) j=inn.length;
      inn.splice(j,0,...AFTER.filter(a=>!has(a.id)).map(a=>Object.assign({},a)));
    }
    src.in=inn;
  }
  if(!Array.isArray(o.settle)){MIGRATED=true;src.settle=defaultCats().settle}
  const r={};
  TYPES.forEach(type=>{
    const seen=new Set([OTHER[type]]),list=[];
    src[type].forEach(x=>{
      if(!x||typeof x.id!=='string'||typeof x.name!=='string') return;
      const name=x.name.trim().slice(0,20);
      if(!name||seen.has(x.id)) return;
      const o2={id:x.id,name:name,h:Number(x.h)||0};
      if(type==='in'&&typeof x.opt==='boolean') o2.opt=x.opt;
      seen.add(x.id);list.push(o2);
    });
    list.push({id:OTHER[type],name:OTHER[type],h:type==='out'?280:0});
    r[type]=list;
  });
  return r;
}
const packCats=()=>({out:CATS.out,in:CATS.in,ded:CATS.ded,save:CATS.save,settle:CATS.settle});

/* 일정(적용 시작 월별 금액) */
const mkey=(y,m)=>y+'-'+String(m).padStart(2,'0');
function normSched(a){
  const r=[];
  (Array.isArray(a)?a:[]).forEach(s=>{
    if(s&&typeof s.from==='string'&&/^\d{4}-\d{2}$/.test(s.from)) r.push({from:s.from,amt:Math.max(0,Math.round(Number(s.amt))||0)});
  });
  r.sort((a,b)=>a.from<b.from?-1:a.from>b.from?1:0);
  return r;
}
function schedAmt(sched,key){
  let r=null;
  for(const s of sched){if(s.from<=key) r=s.amt;else break}
  return r;
}
function setSched(sched,from,amt){
  const i=sched.findIndex(s=>s.from===from);
  if(i>=0) sched[i].amt=amt;else sched.push({from:from,amt:amt});
  sched.sort((a,b)=>a.from<b.from?-1:a.from>b.from?1:0);
}
const ymIdx=k=>Number(k.slice(0,4))*12+Number(k.slice(5,7))-1;
const idxKey=i=>mkey(Math.floor(i/12),i%12+1);
const fxStart=f=>f.start||(f.sched.length?f.sched[0].from:'');
const fxIdx=(f,key)=>{const s0=fxStart(f);return s0?ymIdx(key)-ymIdx(s0)+1:0};
function plannedAmt(f,key){
  const s0=fxStart(f);if(!s0) return 0;
  const i=fxIdx(f,key);
  if(i<1||(f.count>0&&i>f.count)) return 0;
  return schedAmt(f.sched,key)||0;
}
const ymText=k=>Number(k.slice(0,4))+'년 '+Number(k.slice(5))+'월';
function instText(f,key){
  if(!(f.count>0)||!fxStart(f)) return '';
  const i=fxIdx(f,key),end=idxKey(ymIdx(fxStart(f))+f.count-1);
  if(i<1) return '할부 시작 전 (총 '+f.count+'회, '+ymText(end)+' 종료)';
  if(i>f.count) return '할부 종료 (총 '+f.count+'회)';
  return '할부 '+i+'/'+f.count+'회차, 남은 '+(f.count-i)+'회 ('+ymText(end)+' 종료)';
}
function instRemain(f,key){
  if(!(f.count>0)||!fxStart(f)) return null;
  const i=Math.max(fxIdx(f,key),0);let n=0,sum=0;
  for(let j=i+1;j<=f.count;j++){n++;sum+=plannedAmt(f,idxKey(ymIdx(fxStart(f))+j-1))}
  return {n:n,sum:sum};
}

function normFixed(a){
  const r=[];
  const ok=x=>typeof x==='string'&&/^\d{4}-\d{2}$/.test(x);
  (Array.isArray(a)?a:[]).forEach(f=>{
    if(!f||typeof f.id!=='string'||typeof f.name!=='string') return;
    const t=f.t==='save'?'save':(f.t==='settle'?'settle':'out');
    r.push({id:f.id,name:f.name.slice(0,24),t:t,cat:String(f.cat||OTHER[t]),
      day:Math.max(0,Math.min(31,Math.floor(Number(f.day))||0)),sched:normSched(f.sched),
      count:Math.max(0,Math.min(240,Math.floor(Number(f.count))||0)),
      start:ok(f.start)?f.start:'',show:ok(f.show)?f.show:'',
      fd:typeof f.fd==='string'?f.fd:'',fa:Math.max(0,Math.round(Number(f.fa))||0),
      k:t==='settle'?(f.k==='in'?'in':'out'):'',sp:(t==='out'&&typeof f.sp==='string')?f.sp:'',auto:t==='out'&&!!f.auto});
  });
  return r;
}
function normFunds(a){
  const r=[];
  (Array.isArray(a)?a:[]).forEach(f=>{
    if(!f||typeof f.id!=='string'||typeof f.name!=='string') return;
    const tx=[];
    (Array.isArray(f.tx)?f.tx:[]).forEach(t=>{
      if(!t||(t.k!=='in'&&t.k!=='out')||!isFinite(Number(t.a))) return;
      const o={id:String(t.id||('t'+Math.random().toString(36).slice(2,9))),k:t.k,y:Number(t.y)||NOW.getFullYear(),m:Math.max(1,Math.min(12,Number(t.m)||1)),d:Math.max(1,Math.min(31,Number(t.d)||1)),a:Math.max(0,Math.round(Number(t.a))),n:String(t.n||'')};
      if(t.r) o.r=String(t.r);
      if(t.o) o.o=true;
      if(t.cv&&t.k==='out') o.cv=true;
      tx.push(o);
    });
    r.push({id:f.id,name:f.name.slice(0,20),h:Number(f.h)||160,plan:normSched(f.plan),use:normSched(f.use),tx:tx});
  });
  return r;
}
function normPlans(a){
  const r=[];
  (Array.isArray(a)?a:[]).forEach(p=>{
    if(!p||typeof p.id!=='string') return;
    const off={},ov={};
    if(p.off&&typeof p.off==='object') Object.keys(p.off).forEach(k=>{if(p.off[k]) off[k]=true});
    if(p.ov&&typeof p.ov==='object') Object.keys(p.ov).forEach(k=>{const v=Number(p.ov[k]);if(isFinite(v)) ov[k]=v});
    const extra=[];
    (Array.isArray(p.extra)?p.extra:[]).forEach(x=>{
      if(!x||(x.t!=='in'&&x.t!=='out')||!isFinite(Number(x.a))) return;
      extra.push({id:String(x.id||newId()),n:String(x.n||'').slice(0,20),t:x.t,a:Math.max(0,Math.round(Number(x.a))),on:x.on!==false});
    });
    r.push({id:p.id,name:String(p.name||'계획').slice(0,16),off:off,ov:ov,extra:extra});
  });
  return r;
}

function normIplan(o){
  o=o&&typeof o==='object'?o:{};
  const events=[];
  (Array.isArray(o.events)?o.events:[]).forEach(e=>{
    if(!e||typeof e.name!=='string') return;
    events.push({id:String(e.id||('e'+Math.random().toString(36).slice(2,8))),name:e.name.slice(0,24),
      y:Math.max(0,Math.floor(Number(e.y))||0),m:Math.max(1,Math.min(12,Math.floor(Number(e.m))||1)),amt:Math.max(0,Math.round(Number(e.amt))||0)});
  });
  const carry={};
  if(o.carry&&typeof o.carry==='object') Object.keys(o.carry).forEach(k=>{const v=Number(o.carry[k]);if(isFinite(v)&&/^\d{4}$/.test(k)) carry[k]=Math.round(v)});
  return {base:Math.max(0,Math.round(Number(o.base))||0),events:events,carry:carry};
}
/* 설정(분류, 고정 지출, 예비, 계획) */
let CATS=defaultCats(),FIXED=[],FUNDS=[],PLANS=[],IPLAN={base:0,events:[],carry:{}},HIDE={},CFG_TS=0;
function normHide(o){
  const r={};
  if(o&&typeof o==='object') ['out','in','ded','save','settle'].forEach(k=>{if(Array.isArray(o[k])) r[k]=o[k].filter(x=>typeof x==='string'&&x).slice(0,300)});
  return r;
}
const packCfg=()=>({cats:packCats(),fixed:FIXED,funds:FUNDS,plans:PLANS,iplan:IPLAN,hide:HIDE,ts:CFG_TS});
function applyCfg(o){
  if(!o||typeof o!=='object') return false;
  const n=normCats(o.cats);if(!n) return false;
  CATS=n;FIXED=normFixed(o.fixed);FUNDS=normFunds(o.funds);PLANS=normPlans(o.plans);IPLAN=normIplan(o.iplan);HIDE=normHide(o.hide);
  CFG_TS=Number(o.ts)||0;
  return true;
}
const findCat=(type,id)=>CATS[type].find(c=>c.id===id);
const effId=t=>findCat(t.t,t.c)?t.c:OTHER[t.t];
const catName=(type,id)=>{const c=findCat(type,id);return c?c.name:OTHER[type]};
function isOptCat(id){
  const c=findCat('in',id);
  return (c&&typeof c.opt==='boolean')?c.opt:(id===OTHER.in||(!!c&&c.name.indexOf('방과후')>=0));
}
const incHidden=t=>!S.optIn&&t.t==='in'&&isOptCat(effId(t));
const outColor=id=>{const c=findCat('out',id);return c?'hsl('+c.h+' 40% 46%)':'var(--muted)'};
const typeColor=type=>type==='in'?'var(--in)':type==='ded'?'var(--ded)':type==='save'?'var(--save)':type==='settle'?'var(--settle)':'var(--out)';
const dotColor=t=>t.t==='out'?outColor(effId(t)):typeColor(t.t);
function newHue(){
  const used=CATS.out.map(c=>c.h);let best=5,bd=-1;
  for(let h=5;h<360;h+=5){
    let md=360;used.forEach(u=>{const d=Math.abs(h-u);md=Math.min(md,Math.min(d,360-d))});
    if(md>bd){bd=md;best=h}
  }
  return best;
}

/* ───── 도우미 ───── */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won=n=>Math.round(n).toLocaleString('ko-KR');
const pad=n=>String(n).padStart(2,'0');
const num=s=>Number(String(s==null?'':s).replace(/[^\d]/g,''))||0;
const daysIn=(y,m)=>new Date(y,m,0).getDate();
const newId=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const delta=n=>n===0?'-':(n>0?'+':MINUS)+won(Math.abs(n));
const YEARS={};
const blank=()=>({tx:[],budget:null,skip:[],ts:0});
function cleanTx(t){
  if(!t||!OTHER[t.t]||!isFinite(Number(t.a))) return null;
  const o={id:String(t.id||newId()),d:Math.max(0,Math.min(31,Math.floor(Number(t.d))||0)),t:t.t,
    c:String(t.c||OTHER[t.t]),n:String(t.n||''),a:Math.max(0,Math.round(Number(t.a))),m:String(t.m||'')};
  if(t.fx) o.fx=String(t.fx);
  if(t.t==='settle') o.k=t.k==='out'?'out':'in';
  if(t.fd&&Number(t.fa)>0){o.fd=String(t.fd);o.fa=Math.min(Math.round(Number(t.fa)),o.a)}
  if(t.t==='out'&&t.sp) o.sp=String(t.sp);
  return o;
}
function unpack(o){
  if(!o||typeof o!=='object') return blank();
  const tx=(Array.isArray(o.tx)?o.tx:[]).map(cleanTx).filter(Boolean);
  let budget=null;
  if(Array.isArray(o.bud)){
    budget={};
    o.bud.forEach((x,i)=>{
      if(x&&typeof x==='object'&&!Array.isArray(x)){if(x.k!=null) budget[String(x.k)]=Math.max(0,Math.round(Number(x.v))||0)}
      else if(Array.isArray(x)){budget[String(x[0])]=Math.max(0,Math.round(Number(x[1]))||0)}
      else if(LEGACY_OUT[i]!==undefined){budget[LEGACY_OUT[i]]=Math.max(0,Math.round(Number(x))||0)}
    });
  }
  return {tx,budget,skip:(Array.isArray(o.skip)?o.skip.map(String):[]),ts:Number(o.ts)||0};
}
function pack(md){
  return {tx:md.tx,bud:md.budget?Object.keys(md.budget).map(k=>({k:k,v:md.budget[k]})):null,skip:md.skip,ts:md.ts};
}
function resolveBudget(y,m){
  const ms=ensureYear(y);let src=null;
  for(let k=m;k>=1;k--){if(ms[k].budget){src=ms[k].budget;break}}
  if(!src){const py=ensureYear(y-1);for(let k=12;k>=1;k--){if(py[k].budget){src=py[k].budget;break}}}
  const r={};CATS.out.forEach(c=>{r[c.id]=src?(src[c.id]||0):0});
  return r;
}
function hasAnyBudgetBefore(y,m){
  const ms=ensureYear(y);
  for(let k=m-1;k>=1;k--){if(ms[k].budget) return true}
  const py=ensureYear(y-1);
  for(let k=12;k>=1;k--){if(py[k].budget) return true}
  return false;
}
function monthStats(y,m){
  const md=ensureYear(y)[m];
  const r={in:0,out:0,save:0,ded:0,setIn:0,setOut:0,setLinked:0,cat:{},catNet:{},fundPaidM:0,inCat:{},dedCat:{},n:md.tx.length};
  md.tx.forEach(t=>{
    if(incHidden(t)) return;
    if(t.t==='settle'){if(t.k==='out') r.setOut+=t.a;else r.setIn+=t.a;return}
    if(t.t==='out'&&t.sp&&findCat('settle',t.sp)) r.setLinked+=t.a;
    r[t.t]+=t.a;
    const id=effId(t);
    if(t.t==='out'){r.cat[id]=(r.cat[id]||0)+t.a;r.catNet[id]=(r.catNet[id]||0)+t.a-(t.fa||0);r.fundPaidM+=(t.fa||0)}
    else if(t.t==='in') r.inCat[id]=(r.inCat[id]||0)+t.a;
    else if(t.t==='ded') r.dedCat[id]=(r.dedCat[id]||0)+t.a;
  });
  r.catCash=Object.assign({},r.catNet);r.autoOut=0;r.autoMap={};
  const akey=mkey(y,m);
  FIXED.forEach(f=>{
    if(!f.auto||(f.t||'out')!=='out') return;
    if(y>NOW.getFullYear()||(y===NOW.getFullYear()&&m>NOW.getMonth()+1)) return;
    const a=plannedAmt(f,akey);if(!(a>0)) return;
    const id=findCat('out',f.cat)?f.cat:OTHER.out;
    r.cat[id]=(r.cat[id]||0)+a;r.catNet[id]=(r.catNet[id]||0)+a;r.out+=a;r.autoOut+=a;r.autoMap[id]=(r.autoMap[id]||0)+a;
  });
  r.outNet=r.out-r.fundPaidM;
  r.net=r.in-r.ded;
  r.base=S.net?r.net:r.in;
  r.remain=r.base-r.out-r.save;
  r.typedMap=resolveBudget(y,m);
  const key=mkey(y,m);r.fixMap={};
  FIXED.forEach(f=>{
    if((f.t||'out')!=='out') return;
    const a0=plannedAmt(f,key);if(!(a0>0)) return;
    const ctx=md.tx.find(t=>t.fx===f.id);
    const a=a0-(ctx?Math.min(ctx.fa||0,a0):fixedFa(f,a0));if(!(a>0)) return;
    const id=findCat('out',f.cat)?f.cat:OTHER.out;
    r.fixMap[id]=(r.fixMap[id]||0)+a;
  });
  r.budMap={};CATS.out.forEach(c=>{r.budMap[c.id]=(r.typedMap[c.id]||0)+(r.fixMap[c.id]||0)});
  r.typedTotal=CATS.out.reduce((s,c)=>s+(r.typedMap[c.id]||0),0);
  r.fixTotal=CATS.out.reduce((s,c)=>s+(r.fixMap[c.id]||0),0);
  r.bud=r.typedTotal+r.fixTotal;
  return r;
}
const fixedFa=(f,amt)=>(f.fd&&FUNDS.some(x=>x.id===f.fd))?Math.min(f.fa||0,amt):0;
function pendingFunds(y,m){
  const md=ensureYear(y)[m],key=mkey(y,m),items=[];
  FUNDS.forEach(f=>{
    const amt=schedAmt(f.plan,key)||0;if(!(amt>0)) return;
    if(f.tx.some(t=>t.k==='in'&&!t.o&&t.y===y&&t.m===m)) return;
    items.push({fund:f,amt:amt,skipped:md.skip.indexOf('fd:'+f.id)>=0});
  });
  return items;
}
function pendingFixed(y,m){
  const md=ensureYear(y)[m],key=mkey(y,m),items=[];
  FIXED.forEach(f=>{
    if(f.auto) return;
    const amt=plannedAmt(f,key);
    if(!(amt>0)) return;
    if(f.show&&key<f.show) return;
    if(md.tx.some(t=>t.fx===f.id)) return;
    items.push({f:f,amt:amt,fa:fixedFa(f,amt),skipped:md.skip.indexOf(f.id)>=0});
  });
  return items;
}

/* ───── 이월과 월별 흐름 ───── */
const sgn=n=>n>0?'+'+won(n):n<0?MINUS+won(-n):'0';
const signedNum=x=>{x=String(x==null?'':x).trim();return (/^[-\u2212]/.test(x)?-1:1)*num(x)};
function isPast(y,m){const cy=NOW.getFullYear(),cm=NOW.getMonth()+1;return y<cy||(y===cy&&m<cm)}
function netOf(y,m){let a=0;ensureYear(y)[m].tx.forEach(t=>{if(t.t==='in'){if(!incHidden(t)) a+=t.a}else if(t.t==='ded') a-=t.a});return a}
function incomeEvents(y,m){return IPLAN.events.filter(e=>e.amt>0&&(e.y===0||e.y===y)&&e.m===m)}
function regularInfo(){
  let y=NOW.getFullYear();
  for(let tries=0;tries<2;tries++,y--){
    const ms=[];let sum=0;
    M12.forEach(m=>{const n=netOf(y,m);if(n>0&&!incomeEvents(y,m).length){ms.push(m);sum+=n}});
    if(ms.length) return {y:y,months:ms,avg:Math.round(sum/ms.length)};
  }
  return {y:NOW.getFullYear(),months:[],avg:0};
}
const baseIncome=()=>IPLAN.base>0?IPLAN.base:regularInfo().avg;
const forecastIncome=(y,m)=>baseIncome()+incomeEvents(y,m).reduce((s,e)=>s+e.amt,0);
function monthFlow(y,m){
  const st=monthStats(y,m),md=ensureYear(y)[m],key=mkey(y,m);
  const pend=pendingFixed(y,m).filter(x=>!x.skipped);
  const pendSave=pend.filter(x=>(x.f.t||'out')==='save').reduce((s,x)=>s+x.amt,0);
  const pendFix=pend.filter(x=>(x.f.t||'out')==='out').reduce((s,x)=>s+x.amt-x.fa,0);
  const pendSetIn=pend.filter(x=>x.f.t==='settle'&&x.f.k==='in').reduce((s,x)=>s+x.amt,0);
  const pendSetOut=pend.filter(x=>x.f.t==='settle'&&x.f.k!=='in').reduce((s,x)=>s+x.amt,0);
  const cash=t=>t.a-(t.fa||0);
  const fixConf=md.tx.filter(t=>t.t==='out'&&t.fx).reduce((s,t)=>s+cash(t),0);
  const varRec=md.tx.filter(t=>t.t==='out'&&!t.fx).reduce((s,t)=>s+cash(t),0);
  const fundPaid=md.tx.filter(t=>t.t==='out'&&t.fa>0).reduce((s,t)=>s+t.fa,0);
  const forecasted=!(st.net>0);
  const incomeUsed=forecasted?forecastIncome(y,m):st.net;
  let fundRec=0,fundPlan=0,fundC=0;
  FUNDS.forEach(f=>{
    const rec=f.tx.filter(t=>t.k==='in'&&!t.o&&t.y===y&&t.m===m).reduce((s,t)=>s+t.a,0),pl=schedAmt(f.plan,key)||0;
    fundRec+=rec;fundPlan+=pl;
    if(rec>0) fundC+=rec;else if(md.skip.indexOf('fd:'+f.id)<0) fundC+=pl;
  });
  const cover=FUNDS.reduce((s,f)=>s+f.tx.filter(t=>t.k==='out'&&t.cv&&t.y===y&&t.m===m).reduce((a,t)=>a+t.a,0),0);
  const saveC=st.save+pendSave,fixC=fixConf+pendFix;
  const setNet=st.setIn-st.setOut,setAll=setNet+pendSetIn-pendSetOut;
  const avail=incomeUsed+setAll-fixC;
  const varBud=st.typedTotal;
  const past=isPast(y,m),assumed=false;
  const now=avail-varRec,exp=avail-Math.max(varRec,varBud);
  const surplus=past?now:exp;
  const netNow=now-fundC+cover,netExp=exp-fundC+cover,net=surplus-fundC+cover;
  return {st:st,incomeUsed:incomeUsed,forecasted:forecasted,saveC:saveC,fundC:fundC,fundRec:fundRec,fundPlan:fundPlan,
    fixC:fixC,fixConf:fixConf,pendFix:pendFix,fundPaid:fundPaid,setNet:setNet,setAll:setAll,pendSetIn:pendSetIn,pendSetOut:pendSetOut,pendSave:pendSave,avail:avail,varRec:varRec,varBud:varBud,
    now:now,exp:exp,surplus:surplus,net:net,netNow:netNow,netExp:netExp,cover:cover,assumed:assumed,past:past,events:incomeEvents(y,m)};
}
function carryStart(y,depth){
  if(IPLAN.carry[y]!=null) return IPLAN.carry[y];
  if(y<=FIRST_YEAR||(depth||0)>6) return 0;
  return chainYear(y-1,(depth||0)+1).end;
}
function chainYear(y,depth){
  let carry=carryStart(y,depth||0);const start=carry,rows={};
  M12.forEach(m=>{
    const f=monthFlow(y,m);
    rows[m]=Object.assign(f,{carryIn:carry,cum:carry+f.net,cumNow:carry+f.netNow,cumExp:carry+f.netExp});
    carry=carry+f.net;
  });
  return {rows:rows,end:carry,start:start};
}

/* ───── 계정 저장 (db) ───── */
function rowInfo(b,act){
  const over=b>0&&act>b;
  return {
    p:b>0?Math.min(act/b*100,100):(act>0?100:0),
    act:act?won(act):'-',
    txt:b>0?(over?'초과 '+won(act-b):won(b-act)):(act>0?'예산 없음':'-'),
    cls:over?'over':''
  };
}
function fundBalAt(y,m){
  const lim=y*12+m;
  return FUNDS.reduce((s,f)=>s+fundEntries(f).reduce((a,t)=>(t.y*12+t.m<=lim?a+(t.k==='in'?t.a:-t.a):a),0),0);
}
function yearData(){
  const ms=M12.map(m=>monthStats(S.year,m));
  const t={in:0,out:0,autoOut:0,save:0,ded:0,net:0,base:0,active:0,after:0,fundPaid:0,setIn:0,setOut:0};
  ms.forEach(s=>{t.setIn+=s.setIn;t.setOut+=s.setOut;t.in+=s.in;t.out+=s.out;t.autoOut+=s.autoOut;t.save+=s.save;t.ded+=s.ded;t.net+=s.net;t.base+=s.base;if(s.n) t.active++});
  M12.forEach(m=>ensureYear(S.year)[m].tx.forEach(x=>{
    if(x.t==='in'&&!incHidden(x)&&catName('in',effId(x)).indexOf('방과후')>=0) t.after+=x.a;
    if(x.t==='out'&&x.fa>0) t.fundPaid+=x.fa;
  }));
  return {ms:ms,t:t};
}
function fundEntries(f){
  const r=f.tx.map(t=>({id:t.id,k:t.k,y:t.y,m:t.m,d:t.d,a:t.a,n:t.n,r:t.r||'',o:!!t.o,cv:!!t.cv,derived:false}));
  const ys=new Set(Object.keys(YEARS).map(Number));
  for(let y=FIRST_YEAR;y<=NOW.getFullYear()+1;y++) ys.add(y);
  ys.forEach(y=>{
    const ms=ensureYear(y);
    M12.forEach(m=>ms[m].tx.forEach(t=>{
      if(t.t==='out'&&t.fd===f.id&&t.fa>0) r.push({id:'x'+t.id,k:'out',y:y,m:m,d:t.d||1,a:t.fa,n:t.n||'지출',r:'지출 연동 ('+m+'월)',derived:true});
    }));
  });
  return r;
}
const fundBal=f=>fundEntries(f).reduce((s,t)=>s+(t.k==='in'?t.a:-t.a),0);
function drillData(key){
  const m=S.view,md=ensureYear(S.year)[m],rows=[],pend=[];
  const add=(t,amt,note)=>rows.push({id:t.id,d:t.d,c:catName(t.t,effId(t)),n:t.n,a:amt,note:note||''});
  const P=pendingFixed(S.year,m).filter(x=>!x.skipped);
  const addP=(x,amt)=>pend.push({d:x.f.day,c:catName(x.f.t||'out',findCat(x.f.t||'out',x.f.cat)?x.f.cat:OTHER[x.f.t||'out']),n:x.f.name,a:amt});
  let title='',signed=false;
  if(key==='in'){title='수입(세전)';md.tx.filter(t=>t.t==='in').forEach(t=>add(t,t.a,incHidden(t)?'제외 중':''))}
  else if(key==='ded'){title='공제';md.tx.filter(t=>t.t==='ded').forEach(t=>add(t,t.a))}
  else if(key==='set'){
    title='정산 순액';signed=true;
    md.tx.filter(t=>t.t==='settle').forEach(t=>add(t,t.k==='out'?-t.a:t.a,t.k==='out'?'보냄':'받음'));
    P.filter(x=>x.f.t==='settle').forEach(x=>addP(x,x.f.k==='in'?x.amt:-x.amt));
  }
  else if(key==='fix'){
    title='고정 지출 (현금)';
    md.tx.filter(t=>t.t==='out'&&t.fx).forEach(t=>add(t,t.a-(t.fa||0),t.fa?'예비 충당 '+won(t.fa)+'원 제외':''));
    P.filter(x=>(x.f.t||'out')==='out').forEach(x=>addP(x,x.amt-x.fa));
  }
  else if(key==='var'){title='변동 지출 (현금)';md.tx.filter(t=>t.t==='out'&&!t.fx).forEach(t=>add(t,t.a-(t.fa||0),t.fa?'예비 충당 '+won(t.fa)+'원 제외':''))}
  else if(key==='paid'){title='예비 사용';md.tx.filter(t=>t.t==='out'&&t.fa>0).forEach(t=>add(t,t.fa,'전체 '+won(t.a)+'원 중'))}
  else if(key==='save'){title='저축 (통계용)';md.tx.filter(t=>t.t==='save').forEach(t=>add(t,t.a));P.filter(x=>x.f.t==='save').forEach(x=>addP(x,x.amt))}
  else if(key==='fundc'){
    title='예비 적립';
    FUNDS.forEach(f=>f.tx.filter(t=>t.k==='in'&&!t.o&&t.y===S.year&&t.m===m).forEach(t=>rows.push({fid:f.id,id:t.id,d:t.d,c:f.name,n:t.n,a:t.a,note:t.cv?'':''})));
    pendingFunds(S.year,m).filter(x=>!x.skipped).forEach(x=>pend.push({d:0,c:x.fund.name,n:'월 적립 계획',a:x.amt}));
  }
  rows.sort((a,b)=>((a.d||99)-(b.d||99)));
  return {title:title,rows:rows,pend:pend,signed:signed};
}
/* ───── 새 앱용 설정 (분류 기본값, 저장 연결) ───── */
function defaultCats(){
  const mk=n=>({id:n,name:n,h:0});
  const out=['식비-도시락','식비-음료','식비-외식','잡화','관리비','통신비','보험','주유','톨비','오락','미용','할부','카드결제','친목회비','예비 지출'];
  return {
    out:out.map((n,i)=>({id:n,name:n,h:(i*47+10)%360})).concat([{id:'기타',name:'기타',h:280}]),
    in:['본봉','정근수당','정근수당가산금','정액급식비','명절휴가비','교직수당','시간외근무수당','교원연구비','성과상여금'].map(mk).concat([mk('추가 수입')]),
    ded:['소득세','지방소득세','연말정산 소득세','연말정산 지방소득세','일반기여금','건강보험','노인장기요양보험','교직원공제회비','공제회 대출이자','교원연합회비','기타 공제'].map(mk),
    save:['적금','차량저축','의료비 저축','IRP·연금','공제회(회비)','비상금','기타 저축'].map(mk),
    settle:['신미영','조아영','기타 정산'].map(mk)
  };
}
function ensureYear(y){
  if(!YEARS[y]){YEARS[y]={};M12.forEach(m=>{YEARS[y][m]=blank()})}
  return YEARS[y];
}
function saveMonth(y,m){YEARS[y][m].ts=Date.now();Hooks.month(y,m)}
function saveCfg(){CFG_TS=Date.now();Hooks.cfg()}
