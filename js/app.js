/* 가계부 폰 화면 — 홈, 내역, 예산, 통계·흐름, 더보기 + 입력 시트 */
(function(){
"use strict";
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.prototype.slice.call((r||document).querySelectorAll(s));
const app=$('#app'),layer=$('#layer'),toastEl=$('#toast');
const WD=['일','월','화','수','목','금','토'];
const TL={out:'지출',in:'수입',ded:'공제',save:'저축',fund:'예비',settle:'정산'};
const HUES=[8,32,58,92,138,168,196,222,250,280,318,348];
const UI={tab:'home',sv:'stats',filter:'all',fcat:'',fab:false,undo:null,lastC:{},ED:null,PH:null,showSkipped:false,pendOpen:false,sub:'',selMode:false,sel:{},sentinel:false,expectPop:false,expectT:null,cleanTimer:null,QE:null,lp:null,lpFired:0};
const GApp={hooks:{click:[],input:[],change:[],close:[]},subs:{}};window.GApp=GApp;
const isCur=(y,m)=>y===NOW.getFullYear()&&m===NOW.getMonth()+1;
const money=n=>won(n)+'원';
const sg=n=>sgn(n)+'원';
const cls=n=>n<0?'neg':(n>0?'pos':'');
const isoToday=()=>NOW.getFullYear()+'-'+pad(NOW.getMonth()+1)+'-'+pad(NOW.getDate());
const loadY=y=>{if(!YEARS[y]) Store.loadYear(y);return ensureYear(y)};

/* ───── 알림과 되돌리기 ───── */
let toastT=null;
function toast(msg,undo){
  toastEl.innerHTML='<span></span>'+(undo?'<button type="button" data-undo>되돌리기</button>':'');
  toastEl.firstChild.textContent=msg;toastEl.className='toast show';UI.undo=undo||null;
  clearTimeout(toastT);toastT=setTimeout(()=>{toastEl.className='toast';UI.undo=null},undo?7000:3200);
}
function snap(ms){
  const y=S.year;ms=ms||[S.view];
  return {y:y,months:ms.map(m=>({m:m,md:JSON.stringify(pack(ensureYear(y)[m]))})),funds:JSON.stringify(FUNDS)};
}
function restore(s){
  s.months.forEach(x=>{const md=unpack(JSON.parse(x.md));md.ts=Date.now();YEARS[s.y][x.m]=md;saveMonth(s.y,x.m)});
  FUNDS=normFunds(JSON.parse(s.funds));saveCfg();render();
}

/* ───── 표지와 하단 탭 ───── */
function coverHTML(){
  const withMonths=UI.tab==='home'||UI.tab==='list'||UI.tab==='budget';
  let tabs='';
  if(withMonths) for(let m=1;m<=12;m++) tabs+='<button type="button" class="mt'+(m===S.view?' on':'')+(isCur(S.year,m)?' now':'')+'" style="--h:'+HUES[m-1]+'" data-m="'+m+'">'+m+'월</button>';
  return '<header class="cover"><div class="cv-top"><div class="cv-title"><button class="cv-btn" data-yr="-1" aria-label="이전 해">‹</button><h1>'+S.year+' 가계부</h1><button class="cv-btn" data-yr="1" aria-label="다음 해">›</button></div>'+
    '<div class="row-flex"><span class="sync" id="sync"></span><button class="cv-btn" type="button" data-act="search" aria-label="전체 검색" style="margin-right:8px"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></button><button class="who" data-act="who" aria-label="사용자 바꾸기">'+esc(Store.user)+'</button></div></div>'+
    (withMonths?'<nav class="months" id="months" aria-label="월 책갈피">'+tabs+'</nav>':'<div style="height:12px"></div>')+'</header>';
}
const ICON={
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  budget:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/></svg>',
  stats:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
};
function bulkBarHTML(){
  const n=Object.keys(UI.sel).filter(k=>UI.sel[k]).length;
  const cats=['out','in','ded','save'].map(ty=>'<optgroup label="'+TL[ty]+'">'+CATS[ty].map(c=>'<option value="'+ty+'|'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</optgroup>').join('');
  return '<div class="bulkbar"><b>'+n+'건 선택</b><select id="bk-mv" aria-label="다른 달로 옮기기"><option value="">월 옮기기</option>'+M12.filter(x=>x!==S.view).map(x=>'<option value="'+x+'">'+x+'월로</option>').join('')+'</select>'+
    '<select id="bk-cat" aria-label="분류 바꾸기"><option value="">분류 바꾸기</option>'+cats+'</select><button class="btn sm danger" type="button" data-bkdel>삭제</button><button class="btn sm soft" type="button" data-bkend>끝내기</button></div>';
}
function dockHTML(){
  const tabs=[['home','홈'],['list','내역'],['budget','예산'],['stats','통계'],['more','더보기']];
  return '<div class="dock">'+(UI.selMode&&UI.tab==='list'?bulkBarHTML():'')+
    (UI.fab?'<div class="fabmenu"><button type="button" data-act="add">직접 입력</button><button type="button" data-act="photo">📷 사진 찍어 입력</button><button type="button" data-act="gallery">🖼 앨범·캡처에서 입력</button><button type="button" data-act="paste">붙여넣어 입력</button></div>':'')+
    '<button class="fab" type="button" data-act="fab" aria-label="내역 추가">'+(UI.fab?'×':'+')+'</button>'+
    '<nav class="nav" aria-label="주 메뉴">'+tabs.map(t=>'<button type="button" data-tab="'+t[0]+'"'+(UI.tab===t[0]?' class="on" aria-current="page"':'')+'>'+ICON[t[0]]+t[1]+'</button>').join('')+'</nav></div>';
}

/* ───── 홈 ───── */
function fr(op,label,val,o){
  o=o||{};
  const tag=o.drill?'div role="button" tabindex="0" data-drill="'+o.drill+'"':'div';
  return '<'+tag+' class="fr'+(o.key?' key':'')+(o.fund?' fundrow':'')+(o.final?' final'+(o.neg?' neg':''):'')+'"><span class="op">'+op+'</span>'+
    '<span class="t">'+label+(o.sub?'<small>'+o.sub+'</small>':'')+'</span><span class="v num '+(o.vc||'')+'">'+val+'</span></div>';
}
function sweepRow(c,net,m){
  const emg=FUNDS.find(f=>f.name==='비상금'),cur=isCur(S.year,m);
  if(!(c.past||cur)||!net) return '';
  if(!emg) return '<div class="sweep">예비에 “비상금” 통장이 있으면 남은 금액을 넣거나 적자를 보전할 수 있어요.</div>';
  const bal=fundBalAt(S.year,m);
  return '<div class="sweep"><button class="btn sm fill" type="button" data-sweep>'+(net>0?'남은 '+money(net)+' 비상금으로 넣기':'적자 '+money(-net)+' 비상금에서 쓰기')+'</button><span>'+(cur?'(지금까지 기준) ':'')+
    (net<0?(bal<-net?'비상금 잔액 '+money(Math.max(bal,0))+'으로는 모자라요':'비상금 잔액 '+money(bal)):'')+'</span></div>';
}
function pendingHTML(){
  const y=S.year,m=S.view,fx=pendingFixed(y,m),fu=pendingFunds(y,m);
  const act=fx.filter(x=>!x.skipped),fa=fu.filter(x=>!x.skipped),skipped=fx.filter(x=>x.skipped).length+fu.filter(x=>x.skipped).length;
  if(!act.length&&!fa.length&&!skipped) return '';
  const nAct=act.length+fa.length;
  if(!nAct&&skipped&&!UI.pendOpen&&!UI.showSkipped) return '<section class="card pend"><div class="pendsum"><span class="names">건너뛴 '+skipped+'건이 있어요</span><button class="btn sm soft" type="button" data-showskip>보기</button></div></section>';
  let h='<section class="card pend"><h2 class="sec" style="margin:0 4px 2px">확정 대기 '+nAct+'건</h2>'+
    (UI.pendOpen?'':'<div class="names" style="padding:0 4px">'+act.map(x=>esc(x.f.name)).concat(fa.map(x=>esc(x.fund.name)+' 적립')).slice(0,4).join(' · ')+(nAct>4?' 외 '+(nAct-4)+'건':'')+'</div>')+
    '<div class="acts" style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button class="btn sm soft" type="button" data-pendtoggle>'+(UI.pendOpen?'접기':'펼치기')+'</button>'+
    (nAct>1?'<button class="btn sm" type="button" data-confirmall>모두 확정</button>':'')+'</div>';
  if(!UI.pendOpen&&!UI.showSkipped) return h+'</section>';
  act.forEach(x=>{
    const f=x.f,t=f.t||'out';
    h+='<div class="pr" data-pid="fx:'+esc(f.id)+'"><div class="n">'+esc(f.name)+'<small>'+(f.day?f.day+'일 · ':'')+esc(catName(t,findCat(t,f.cat)?f.cat:OTHER[t]))+(t==='save'?' · 저축':'')+(t==='settle'?' · 정산 '+(f.k==='in'?'받음':'보냄'):'')+(x.fa?' · 예비 충당 '+money(x.fa):'')+'</small></div>'+
      '<input class="pa num" inputmode="numeric" value="'+won(x.amt)+'" aria-label="금액">'+
      '<div class="acts"><button class="btn sm soft" type="button" data-skip>건너뛰기</button><button class="btn sm fill" type="button" data-confirm>확정</button></div></div>';
  });
  fa.forEach(x=>{
    h+='<div class="pr" data-pid="fd:'+esc(x.fund.id)+'"><div class="n">'+esc(x.fund.name)+' 적립<small><em class="tag fund">예비</em>월 적립 계획</small></div>'+
      '<input class="pa num" inputmode="numeric" value="'+won(x.amt)+'" aria-label="금액">'+
      '<div class="acts"><button class="btn sm soft" type="button" data-skip>건너뛰기</button><button class="btn sm fill" type="button" data-confirm>확정</button></div></div>';
  });
  if(skipped) h+='<div style="padding:8px 4px 2px"><button class="link" type="button" data-showskip>'+(UI.showSkipped?'건너뛴 항목 숨기기':'건너뛴 '+skipped+'건 다시 보기')+'</button></div>';
  if(UI.showSkipped){
    fx.filter(x=>x.skipped).forEach(x=>{h+='<div class="pr" data-pid="fx:'+esc(x.f.id)+'"><div class="n">'+esc(x.f.name)+'<small>건너뜀 · '+money(x.amt)+'</small></div><div class="acts"><button class="btn sm soft" type="button" data-unskip>다시 보이기</button></div></div>'});
    fu.filter(x=>x.skipped).forEach(x=>{h+='<div class="pr" data-pid="fd:'+esc(x.fund.id)+'"><div class="n">'+esc(x.fund.name)+' 적립<small>건너뜀 · '+money(x.amt)+'</small></div><div class="acts"><button class="btn sm soft" type="button" data-unskip>다시 보이기</button></div></div>'});
  }
  return h+'</section>';
}
function homeHTML(){
  const y=S.year,m=S.view,c=chainYear(y).rows[m],st=c.st;
  const sur=c.past?c.surplus:c.now,net=c.past?c.net:c.netNow,usable=c.incomeUsed+c.setAll;
  const bud=st.bud,used=st.outNet,remain=bud-used,pct=bud>0?Math.round(used/bud*100):null;
  const dim=daysIn(y,m),cur=isCur(y,m),left=cur?dim-NOW.getDate()+1:(c.past?0:dim);
  let h='<section class="card stitch hero">';
  if(bud>0){
    h+='<div class="lb">'+m+'월 남은 예산 <span class="sub">(변동+고정 예산 − 쓴 금액)</span></div>'+
      '<div class="big num '+(remain<0?'neg':'')+'">'+(remain<0?'초과 '+won(-remain):won(remain))+'<span style="font-size:20px">원</span></div>'+
      '<div class="bar"><i class="'+(pct>100?'over':pct>=85?'warn':'')+'" style="width:'+Math.min(pct,100)+'%"></i></div>'+
      '<div class="meta"><span>예산 '+money(bud)+'</span><span>사용 '+money(used)+' ('+pct+'%)</span></div>';
    if(remain>0&&left>0&&!c.past) h+='<div class="perday">'+(cur?'오늘부터 월말까지':'이 달은')+' 하루 평균 <b class="num">'+money(Math.floor(remain/left))+'</b> 쓸 수 있어요 <span class="sub">('+left+'일)</span></div>';
    else if(remain<0) h+='<div class="perday neg">예산을 '+money(-remain)+' 넘었어요.</div>';
    if(st.fundPaidM) h+='<div class="sub" style="margin-top:6px">예비로 충당한 '+money(st.fundPaidM)+'은 뺐어요.</div>';
  }else h+='<div class="lb">'+m+'월 예산</div><p class="empty" style="margin:10px 0">예산 탭에서 분류별 변동 예산을 적어 보세요.</p>';
  h+='</section>';
  if(c.forecasted&&(c.past||cur)) h+='<section class="card" style="border-color:var(--out)"><b>'+m+'월 급여를 아직 입력하지 않았어요</b><div class="sub" style="margin:2px 0 8px">지난달 급여를 복사해서 금액만 고치면 빨라요. 입력 전에는 평균으로 예상해서 계산해요.</div><div class="row-flex" style="gap:8px"><button class="btn sm fill" type="button" data-act="copypay">지난달 급여 복사</button><button class="btn sm soft" type="button" data-act="addin">직접 입력</button></div></section>';
  const bk=GApp.backupNag();if(bk) h+=bk;
  const overs=CATS.out.filter(k=>(st.budMap[k.id]||0)>0&&(st.catNet[k.id]||0)>st.budMap[k.id]);
  if(overs.length) h+='<div class="scroll-x" aria-label="예산을 넘은 분류">'+overs.map(k=>'<button class="chip over" type="button" data-gocat="'+esc(k.id)+'">'+esc(k.name)+' +'+won(st.catNet[k.id]-st.budMap[k.id])+'</button>').join('')+'</div>';
  h+=pendingHTML();
  h+='<section class="card calc"><h2 class="sec" style="margin:6px 14px 6px">'+m+'월 계산서</h2>'+
    fr('','실수령 (세후)',c.forecasted?'예상 '+money(c.incomeUsed):money(st.net),{drill:'in',sub:c.forecasted?'급여 기록 전이라 평균으로 예상':'수입 '+money(st.in)+' − 공제 '+money(st.ded)})+
    ((st.setIn||st.setOut||c.pendSetIn||c.pendSetOut)?fr('±','정산 순액',sg(c.setAll),{drill:'set',vc:cls(c.setAll),sub:'받음 '+money(st.setIn)+' · 보냄 '+money(st.setOut)}):'')+
    fr('=','사용 가능 예산',money(usable),{key:1})+
    fr('−','고정 지출',money(c.fixC),{drill:'fix',sub:'확정 '+money(c.fixConf)+(c.pendFix?' + 예정 '+money(c.pendFix):'')})+
    fr('=','생활비 가용액',(c.avail<0?MINUS:'')+money(Math.abs(c.avail)),{key:1,vc:c.avail<0?'neg':''})+
    fr('−','쓴 금액 (변동 지출)',money(c.varRec),{drill:'var',sub:'변동 예산 '+money(c.varBud)+'은 참고'})+
    fr('=',c.past?'이번 달 수지':'지금까지 수지',sg(sur),{key:1,vc:cls(sur)});
  if(!c.past) h+='<div class="sweep" style="margin-top:0">월말 예상 수지 '+sg(c.exp)+' (변동 예산을 다 쓴다고 보면)</div>';
  if(FUNDS.length||c.fundC||c.fundPaid) h+=fr('−','예비 적립',money(c.fundC),{drill:'fundc',fund:1,sub:'이번 달 입금'})+
    (c.fundPaid>0?fr('','예비 사용',money(c.fundPaid),{drill:'paid',fund:1}):'')+
    (c.cover>0?fr('+','비상금에서 적자 보전',money(c.cover),{fund:1}):'')+
    fr('','예비 잔액',money(fundBalAt(y,m)),{fund:1});
  h+=fr('=','이월로 넘어가는 금액',sg(net),{final:1,neg:net<0,vc:cls(net)})+sweepRow(c,net,m)+
    fr('+','이월 (지난달까지)',sg(c.carryIn),{vc:cls(c.carryIn)})+
    fr('=','누적',sg(c.past?c.cum:c.cumNow),{key:1,vc:cls(c.past?c.cum:c.cumNow)});
  if(!c.past) h+='<div class="sweep" style="margin-top:0">월말 예상 누적 '+sg(c.cumExp)+'</div>';
  h+=fr('','저축 (통계용)',money(c.saveC),{drill:'save',sub:'월 수지에는 넣지 않아요'})+'</section>';
  const md=ensureYear(y)[m],recent=md.tx.slice().sort((a,b)=>(b.d||0)-(a.d||0)).slice(0,5);
  h+='<h2 class="sec">최근 내역</h2>'+(recent.length?recent.map(itemHTML).join(''):'<p class="empty">아직 내역이 없어요.<br>아래 + 버튼으로 시작해 보세요.</p>')+
    (md.tx.length>5?'<p style="text-align:center"><button class="link" type="button" data-tab="list">전체 보기</button></p>':'');
  return h;
}

/* ───── 내역 ───── */
function itemHTML(t){
  const isF=!!t.fid,dim='',pick=UI.sel[t.id]?' picked':'',chk=UI.selMode?'<span class="chk'+(UI.sel[t.id]?' on':'')+'">✓</span>':'';
  if(isF){
    const sign=t.k==='in'?'+':MINUS;
    return '<div class="it'+(UI.selMode?' dim':'')+'" role="button" tabindex="0" data-fit="'+esc(t.fid)+':'+esc(t.id)+'" style="--cat:var(--fund)"><i class="dot"></i><div class="mid"><b>'+esc(t.n||(t.k==='in'?'예비 입금':'예비 출금'))+'</b><small><em class="tag fund">예비</em>'+esc(t.fname)+(t.o?' · 기존 잔액':t.cv?' · 적자 보전':'')+'</small></div><div class="amt num fund-'+t.k+'">'+sign+won(t.a)+'</div></div>';
  }
  const ty=t.t,sign=ty==='in'?'+':(ty==='out'||ty==='ded')?MINUS:(ty==='settle'?(t.k==='out'?MINUS:'+'):'');
  const acls=ty==='settle'?'settle-'+(t.k==='out'?'out':'in'):(ty==='out'?'':ty);
  const fu=t.fa>0?FUNDS.find(f=>f.id===t.fd):null;
  let sub='<em class="tag'+(ty==='settle'?' settle':'')+'">'+(ty==='settle'?'정산 '+(t.k==='out'?'보냄':'받음'):TL[ty])+'</em><span class="qcat" data-qe="cat">'+esc(catName(ty,effId(t)))+'</span>';
  if(fu) sub+=' · 예비 충당 '+won(t.fa)+' ('+esc(fu.name)+')';
  if(t.sp&&findCat('settle',t.sp)) sub+=' · '+esc(catName('settle',t.sp))+'에게 송금';
  if(t.fx) sub+=' · 고정';
  return '<div class="it'+(incHidden(t)?' dim':'')+pick+'" role="button" tabindex="0" data-it="'+esc(t.id)+'" style="--cat:'+dotColor(t)+'">'+(chk||'<i class="dot"></i>')+'<div class="mid"><b>'+esc(t.n||catName(ty,effId(t)))+'</b><small>'+sub+'</small>'+(t.m?'<small class="note">'+esc(t.m)+'</small>':'')+'</div><div class="amt num '+acls+'" data-qe="amt">'+sign+won(t.a)+'</div></div>';
}
function listItems(){
  const y=S.year,m=S.view,md=ensureYear(y)[m],items=[];
  md.tx.forEach(t=>{
    if(UI.filter==='fund') return;
    if(UI.filter!=='all'&&t.t!==UI.filter) return;
    if(UI.fcat&&effId(t)!==UI.fcat&&t.sp!==UI.fcat) return;
    items.push(t);
  });
  if(UI.filter==='all'||UI.filter==='fund'){
    FUNDS.forEach(f=>f.tx.forEach(t=>{
      if(t.y!==y||t.m!==m) return;
      if(UI.fcat&&UI.fcat!==f.id) return;
      items.push({fid:f.id,fname:f.name,id:t.id,d:t.d,k:t.k,a:t.a,n:t.n,o:t.o,cv:t.cv});
    }));
  }
  return items;
}
function listHTML(){
  const chips=[['all','전체'],['out','지출'],['in','수입'],['ded','공제'],['save','저축'],['fund','예비'],['settle','정산']];
  let h='<div class="seg" role="group" aria-label="내역 종류">'+chips.map(c=>'<button type="button" class="chip'+(UI.filter===c[0]?' on':'')+'" data-flt="'+c[0]+'">'+c[1]+'</button>').join('')+'</div>';
  if(UI.filter!=='all'){
    const cs=UI.filter==='fund'?FUNDS.map(f=>({id:f.id,name:f.name})):CATS[UI.filter];
    h+='<div class="scroll-x" aria-label="분류"><button type="button" class="chip'+(!UI.fcat?' on':'')+'" data-fc="">전체 분류</button>'+cs.map(c=>'<button type="button" class="chip'+(UI.fcat===c.id?' on':'')+'" data-fc="'+esc(c.id)+'">'+esc(c.name)+'</button>').join('')+'</div>';
  }
  const items=listItems();
  const sum={};items.forEach(t=>{if(t.fid) return;sum[t.t]=(sum[t.t]||0)+t.a});
  h+='<div class="row-flex" style="justify-content:space-between;margin:2px 2px 0"><span class="sub">'+items.length+'건'+(sum.out?' · 지출 '+money(sum.out):'')+(sum.in?' · 수입 '+money(sum.in):'')+'</span><button class="link" type="button" data-act="copypay">지난달 급여 복사</button></div>'+
    (UI.selMode?'':'<p class="sub" style="margin:0 2px 2px">내역을 길게 누르면 여러 개를 한꺼번에 고칠 수 있어요. 금액이나 분류를 누르면 그것만 바로 고쳐요.</p>');
  if(!items.length) return h+'<p class="empty">내역이 없어요.</p>';
  const groups={};items.forEach(t=>{const d=t.d||0;(groups[d]=groups[d]||[]).push(t)});
  Object.keys(groups).map(Number).sort((a,b)=>(a||99)-(b||99)).forEach(d=>{
    const g=groups[d],tot=g.filter(t=>t.t==='out').reduce((s,t)=>s+t.a,0);
    const wd=d?WD[new Date(S.year,S.view-1,d).getDay()]:'';
    h+='<div class="day"><b>'+(d?d+'일 ('+wd+')':'날짜 미정')+'</b><span>'+(tot?'지출 '+money(tot):'')+'</span></div>'+g.map(itemHTML).join('');
  });
  return h;
}

/* ───── 예산 ───── */
function budgetHTML(){
  const y=S.year,m=S.view,st=monthStats(y,m),bud=st.bud,used=st.outNet,pct=bud>0?Math.round(used/bud*100):null;
  let h='<section class="card stitch hero"><div class="lb">'+m+'월 예산 (변동+고정)</div><div class="big num">'+won(bud)+'<span style="font-size:20px">원</span></div>'+
    '<div class="bar"><i class="'+(pct>100?'over':pct>=85?'warn':'')+'" style="width:'+Math.min(pct||0,100)+'%"></i></div>'+
    '<div class="meta"><span>사용 '+money(used)+(pct!=null?' ('+pct+'%)':'')+'</span><span class="'+(bud-used<0?'neg':'')+'">'+(bud-used<0?'초과 '+money(used-bud):'남음 '+money(bud-used))+'</span></div>'+
    (st.fundPaidM?'<div class="sub" style="margin-top:6px">예비로 충당한 '+money(st.fundPaidM)+'은 뺐어요.</div>':'')+'</section>';
  h+='<p class="sub" style="margin:4px 2px">분류를 누르면 변동 예산을 고칠 수 있어요. 한 번 적으면 다음 달에도 이어져요.</p>';
  CATS.out.forEach(c=>{
    const typed=st.typedMap[c.id]||0,fixv=st.fixMap[c.id]||0,b=typed+fixv,a=st.catNet[c.id]||0,i=rowInfo(b,a);
    h+='<button class="bc'+(i.cls==='over'?' over':'')+'" type="button" data-bud="'+esc(c.id)+'" style="--cat:'+outColor(c.id)+'"><div class="row1"><b><i></i>'+esc(c.name)+'</b><span class="num">'+(a?won(a):'-')+' / '+(b?won(b):'-')+'</span></div>'+
      '<div class="bar"><i class="'+(i.cls==='over'?'over':'')+'" style="width:'+i.p+'%"></i></div><div class="row2"><span class="'+(i.cls==='over'?'neg':'')+'">'+i.txt+'</span><span>'+(typed?'변동 '+won(typed):'')+(typed&&fixv?' + ':'')+(fixv?'고정 '+won(fixv):'')+(!typed&&!fixv?'예산 없음':'')+'</span></div></button>';
  });
  return h;
}

/* ───── 통계·흐름 ───── */
function statsHTML(){
  const yd=yearData(),t=yd.t;
  const remain=t.base-(t.out-t.autoOut-t.fundPaid)+(t.setIn-t.setOut);
  const L=(l,v,c,o)=>'<div class="ln'+(o?' '+o:'')+'"><span>'+l+'</span><span class="l"></span><b class="'+(c||'')+'">'+v+'</b></div>';
  let h='<section class="card"><h2 class="sec" style="margin:0 0 6px">'+S.year+'년</h2>'+
    L('총 수입 (세전)',money(t.in))+L('공제','−'+won(t.ded)+'원','')+L('실수령 (세후)',money(t.net))+L('총 지출',money(t.out)+'',''  )+
    (t.fundPaid?L('└ 예비 사용',money(t.fundPaid),'','minor'):'')+L('총 저축',money(t.save),'pos')+
    L('저축률',t.base>0?(t.save/t.base*100).toFixed(1)+'%':'-','','minor')+L('남은 돈',(remain<0?MINUS:'')+won(Math.abs(remain))+'원',cls(remain),'total')+
    '<p class="sub" style="margin:6px 0 0">남은 돈은 저축과 예비 적립을 빼기 전 금액이에요.</p></section>';
  const mx=Math.max.apply(null,yd.ms.map(s=>Math.max(s.base,s.out,1)));
  h+='<h2 class="sec">월별 수입과 지출</h2><div class="mbars" aria-label="월별 막대 그래프">'+yd.ms.map((s,i)=>
    '<div class="mb"><div class="bars"><i style="height:'+Math.round(s.base/mx*100)+'%;background:var(--in)"></i><i style="height:'+Math.round(s.out/mx*100)+'%;background:var(--out)"></i></div><span>'+(i+1)+'</span></div>').join('')+'</div>'+
    '<p class="sub"><span style="color:var(--in)">■</span> 실수령 <span style="color:var(--out)">■</span> 지출</p>';
  const tot={};yd.ms.forEach(s=>Object.keys(s.cat).forEach(k=>{tot[k]=(tot[k]||0)+s.cat[k]}));
  const rows=Object.keys(tot).map(k=>({id:k,v:tot[k]})).sort((a,b)=>b.v-a.v).slice(0,10),mxc=rows.length?rows[0].v:1,sumc=t.out||1;
  const pe={};M12.forEach(m=>ensureYear(S.year)[m].tx.forEach(t=>{if(t.t!=='settle') return;const id=effId(t);(pe[id]=pe[id]||{in:0,out:0})[t.k==='out'?'out':'in']+=t.a}));
  const peKeys=Object.keys(pe);
  const setHTML=peKeys.length?'<h2 class="sec">정산 (주고받은 돈)</h2><p class="sub" style="margin:0 2px 4px">수입이나 지출에 넣지 않고, 월 수지에만 반영돼요.</p><div class="card" style="padding:6px 12px">'+peKeys.map(id=>{const x=pe[id],df=x.in-x.out;return '<div class="ln"><span>'+esc(catName('settle',id))+'</span><span class="l"></span><b class="'+cls(df)+'">'+(df?sg(df):'0원')+'</b></div><div class="sub" style="margin:-2px 0 4px">받음 '+money(x.in)+' · 보냄 '+money(x.out)+'</div>'}).join('')+'</div>':'';
  h+='<h2 class="sec">분류별 지출</h2>'+(rows.length?rows.map(r=>'<div class="hb"><span>'+esc(catName('out',r.id))+'</span><div class="track"><i style="width:'+Math.round(r.v/mxc*100)+'%;background:'+outColor(r.id)+'"></i></div><span class="num">'+won(r.v)+' <small class="sub">'+Math.round(r.v/sumc*100)+'%</small></span></div>').join(''):'<p class="empty">지출 내역이 없어요.</p>');
  h+=setHTML;
  return h;
}
function flowHTML(){
  let y=NOW.getFullYear()<FIRST_YEAR?FIRST_YEAR:NOW.getFullYear(),m=NOW.getFullYear()<FIRST_YEAR?1:NOW.getMonth()+1;
  const rows=[];
  for(let i=0;i<12;i++){loadY(y);rows.push({y:y,m:m,c:chainYear(y).rows[m]});m++;if(m>12){m=1;y++}}
  const last=rows[rows.length-1].c.cum,low=rows.reduce((a,r)=>r.c.cum<a.c.cum?r:a,rows[0]),tot=rows.reduce((s,r)=>s+r.c.net,0);
  let h='<section class="card stitch"><div class="lb sub">12개월 뒤 누적</div><div class="big num '+cls(last)+'" style="font-size:32px;font-weight:700">'+sg(last)+'</div>'+
    '<div class="meta sub" style="display:flex;justify-content:space-between"><span>가장 낮은 때 '+low.y%100+'.'+low.m+'월 '+sg(low.c.cum)+'</span><span>12개월 남는 금액 '+sg(tot)+'</span></div>'+
    '<p class="sub" style="margin:8px 0 0">지난 달은 실제 기록으로, 이번 달과 앞으로는 일반 달 평균 수입과 특별 수입 일정, 변동 예산으로 예상해요.</p></section>';
  h+='<div class="fc" style="font-size:12.5px;color:var(--muted)"><span>월</span><span>남는 금액</span><span>누적</span></div>';
  rows.forEach(r=>{
    const c=r.c;
    h+='<div class="fc'+(c.cum<0?' low':'')+'"><div><b>'+(r.y%100)+'.'+r.m+'월</b>'+(c.past?' <em class="tag">기록</em>':'')+(c.events&&c.events.length?c.events.map(e=>'<span class="ev">+ '+esc(e.name)+' '+money(e.amt)+'</span>').join(''):'')+'</div>'+
      '<span class="num '+cls(c.net)+'">'+sg(c.net)+'</span><span class="num '+cls(c.cum)+'">'+sg(c.cum)+'</span></div>';
  });
  return h;
}
function statsTabHTML(){
  return '<div class="seg" role="group"><button type="button" class="chip'+(UI.sv==='stats'?' on':'')+'" data-sv="stats">통계</button><button type="button" class="chip'+(UI.sv==='flow'?' on':'')+'" data-sv="flow">흐름 (12개월 예상)</button></div>'+(UI.sv==='stats'?statsHTML():flowHTML());
}

/* ───── 더보기 ───── */
function moreHTML(){
  if(UI.sub&&GApp.subs[UI.sub]){
    const sb=GApp.subs[UI.sub];
    return '<div class="row-flex" style="margin:0 0 6px"><button class="btn sm soft" type="button" data-sub="">‹ 더보기</button><h2 class="sec" style="margin:0 0 0 8px">'+sb.title+'</h2></div>'+sb.html();
  }
  const last=GApp.lastBackup();
  const M=(sub,t,d)=>'<button class="menu" type="button" data-sub="'+sub+'">'+t+'<small>'+d+'</small></button>';
  return '<h2 class="sec" style="margin-top:4px">'+esc(Store.user)+' 님의 가계부</h2>'+
    '<button class="menu" type="button" data-act="who">사용자 바꾸기<small>J / Y 중에서 다시 고를 수 있어요</small></button>'+
    '<h2 class="sec">설정</h2>'+
    M('fixed','고정 지출 · 할부','매달 나가는 돈, 저축 이체, 할부, 예비 충당')+
    M('funds','예비 통장','통장별 잔액, 월 적립 계획, 입출금')+
    M('income','추가 수입 · 특별 수입 일정','일반 달 수입 예상, 정근수당·명절휴가비·성과금')+
    M('people','정산 사람','받은 돈과 보낸 돈을 주고받는 사람')+
    M('cats','분류 편집','지출, 수입, 공제, 저축 분류의 이름과 순서')+
    M('photo','사진 분석','사진으로 입력할 때 쓰는 API 키')+
    '<h2 class="sec">데이터</h2>'+
    '<button class="menu" type="button" data-act="export">백업 파일 내보내기<small>'+(last?'마지막 백업 '+last.text:'아직 백업한 적이 없어요')+'</small></button>'+
    '<button class="menu" type="button" data-act="import">백업 파일 가져오기<small>이 앱의 백업 파일이나 기존 가계부 백업을 읽어요</small></button>'+
    '<h2 class="sec">예시</h2>'+
    '<button class="menu" type="button" data-act="seed">예시 데이터 넣기<small>화면을 눌러 보기 위한 예시 기록이에요 (지금 기록은 지워져요)</small></button>'+
    '<button class="menu" type="button" data-act="wipe" style="color:var(--over)">모두 지우기<small>이 사용자의 기록을 모두 지우고 처음부터 시작해요</small></button>'+
    '<p class="sub" style="margin:16px 4px">기록은 이 폰의 브라우저에만 저장돼요(J와 Y는 따로). 브라우저 데이터를 지우거나 앱을 삭제하면 사라지니, 백업 파일을 가끔 받아 두세요.</p>';
}

/* ───── 로그인 ───── */
function loginHTML(){
  return '<div class="login"><div><h1>가계부</h1><p>누구의 가계부를 열까요?</p></div>'+
    '<div class="who2"><button type="button" data-login="J" aria-label="J의 가계부">J</button><button type="button" data-login="Y" aria-label="Y의 가계부">Y</button></div>'+
    '<p class="note">기록은 이 폰에만 저장돼요. J와 Y의 기록은 따로 저장돼요.</p></div>';
}

/* ───── 화면 그리기 ───── */
function screenHTML(){
  switch(UI.tab){
    case 'home':return homeHTML();
    case 'list':return listHTML();
    case 'budget':return budgetHTML();
    case 'stats':return statsTabHTML();
    default:return moreHTML();
  }
}
function render(keepTop){
  if(!Store.user){app.innerHTML=loginHTML();return}
  loadY(S.year);
  app.innerHTML=coverHTML()+'<main class="page" id="main">'+screenHTML()+'</main>'+dockHTML();
  const on=$('.mt.on');if(on&&on.scrollIntoView) on.scrollIntoView({inline:'center',block:'nearest'});
  if(!keepTop) window.scrollTo(0,0);
}

/* ───── 시트(아래에서 올라오는 창) ───── */
function layerOpen(html){
  layer.innerHTML='<div class="scrim" data-close></div><div class="sheet" id="sheet" role="dialog" aria-modal="true"><div class="grab"></div>'+html+'</div>';
  layer.className='open';
  document.documentElement.classList.add('lock');document.body.classList.add('lock');
  histPush();
}
function sheetRender(html){
  const sh=$('#sheet');if(!sh){layerOpen(html);return}
  const top=sh.scrollTop;sh.innerHTML='<div class="grab"></div>'+html;sh.scrollTop=top;
}
/* 안드로이드 뒤로 가기: 시트나 설정 화면이 열려 있는 동안만 기록 한 칸을 더 쌓아 두고,
   뒤로 가기를 누르면 그 한 칸을 써서 시트/화면만 닫아요. (횟수를 세지 않아서 어긋나지 않아요) */
const overlayOpen=()=>layer.className==='open'||!!UI.sub;
function histPush(){
  clearTimeout(UI.cleanTimer);
  if(!UI.sentinel){try{history.pushState({g:1},'')}catch(e){}UI.sentinel=true}
}
function histRelease(){
  clearTimeout(UI.cleanTimer);
  UI.cleanTimer=setTimeout(()=>{
    if(UI.sentinel&&!overlayOpen()){
      UI.sentinel=false;UI.expectPop=true;clearTimeout(UI.expectT);UI.expectT=setTimeout(()=>{UI.expectPop=false},400);   // 내가 한 뒤로 가기 한 번만 건너뛰어요
      try{history.back()}catch(e){UI.expectPop=false}
    }
  },250);
}
function layerClose(fromPop){
  layer.className='';layer.innerHTML='';UI.ED=null;UI.PH=null;UI.BS=null;UI.QE=null;
  document.documentElement.classList.remove('lock');document.body.classList.remove('lock');
  GApp.hooks.close.forEach(f=>f());
  if(!fromPop&&!UI.sub) histRelease();
}
function enterSub(name){UI.sub=name;histPush();render()}
function leaveSub(){UI.sub='';if(layer.className!=='open') histRelease();render()}
window.addEventListener('popstate',()=>{
  if(UI.expectPop){UI.expectPop=false;clearTimeout(UI.expectT);return}
  UI.sentinel=false;
  if(layer.className==='open'){layerClose(true);if(UI.sub) histPush();return}
  if(UI.sub){UI.sub='';render(true)}
});

/* ───── 입력 시트 ───── */
function defaultCat(type){
  if(type==='fund') return FUNDS.length?FUNDS[0].id:'';
  const last=UI.lastC[type];
  return (last&&findCat(type,last))?last:CATS[type][0].id;
}
function recentNames(type){
  const seen={},out=[];let y=S.year,m=S.view;
  for(let i=0;i<12&&out.length<8;i++){
    if(y<FIRST_YEAR-1) break;
    ensureYear(y)[m].tx.slice().reverse().forEach(t=>{if(t.t===type&&t.n&&!t.fx&&!seen[t.n]&&out.length<8){seen[t.n]=1;out.push(t.n)}});
    m--;if(m<1){m=12;y--}
  }
  return out;
}
function lastByName(type,n){
  let y=S.year,m=S.view;
  for(let i=0;i<12;i++){
    if(y<FIRST_YEAR-1) break;
    const l=ensureYear(y)[m].tx.slice().reverse().find(t=>t.t===type&&t.n===n&&!t.fx);
    if(l) return l;
    m--;if(m<1){m=12;y--}
  }
  return null;
}
function openEditor(opt){
  opt=opt||{};
  const y=S.year,m=S.view;
  const e={mode:'add',id:null,fid:null,type:'out',c:'',k:'in',d:isCur(y,m)?NOW.getDate():1,a:'',n:'',m:'',fd:'',fa:'',sp:'',mv:m,o:false,cv:false,inst:false,is:mkey(y,m),ie:'',more:false,fx:''};
  e.ie=idxKey(ymIdx(e.is)+5);
  if(opt.id){
    const t=ensureYear(y)[m].tx.find(x=>x.id===opt.id);if(!t) return;
    Object.assign(e,{mode:'edit',id:t.id,type:t.t,c:effId(t),k:t.k||'in',d:t.d,a:won(t.a),n:t.n,m:t.m,fd:t.fd||'',fa:t.fa?won(t.fa):'',sp:t.sp||'',fx:t.fx||'',more:!!(t.fd||t.sp)});
  }else if(opt.fid){
    const f=FUNDS.find(x=>x.id===opt.fid),t=f&&f.tx.find(x=>x.id===opt.tid);if(!t) return;
    Object.assign(e,{mode:'edit',fid:f.id,id:t.id,type:'fund',c:f.id,k:t.k,d:t.d,a:won(t.a),n:t.n,m:t.r||'',o:!!t.o,cv:!!t.cv,more:!!(t.o||t.cv)});
  }else{
    e.type=opt.type||'out';e.c=opt.c||defaultCat(e.type);if(opt.k) e.k=opt.k;
  }
  UI.ED=e;layerOpen(edHTML());
}
function edSetType(t){
  const e=UI.ED;e.type=t;e.c=defaultCat(t);e.fd='';e.fa='';e.sp='';e.o=false;e.cv=false;e.inst=false;e.k='in';
  if(t==='fund'&&e.d<1) e.d=1;
}
function edHTML(){
  const e=UI.ED,y=S.year,m=S.view,isFund=e.type==='fund',isSet=e.type==='settle',mv=e.mv||m,edit=e.mode==='edit';
  const types=['out','in','ded','save','fund','settle'];
  const lock=t=>edit&&((e.fid&&t!=='fund')||(!e.fid&&t==='fund'));
  let h='<h2>'+(edit?'내역 고치기':'내역 추가')+' <span class="sub">'+y+'년 '+m+'월</span></h2>'+
    '<div class="typeseg" role="group" aria-label="종류">'+types.map(t=>'<button type="button" data-t="'+t+'" class="'+(e.type===t?'on':'')+'"'+(lock(t)?' disabled style="opacity:.3"':'')+'>'+TL[t]+'</button>').join('')+'</div>'+
    '<div class="fld"><label for="ed-a">금액 (원)</label><input id="ed-a" class="inp amount num" inputmode="numeric" placeholder="0" value="'+esc(e.a)+'" autocomplete="off">'+
    '<div class="quick">'+[['1000','+1천'],['10000','+1만'],['50000','+5만'],['100000','+10만']].map(q=>'<button type="button" data-qa="'+q[0]+'">'+q[1]+'</button>').join('')+'<button type="button" data-qa="clear">지우기</button></div></div>';
  h+='<div class="fld"><label for="ed-n">내용</label><input id="ed-n" class="inp" placeholder="'+(isFund?'예) 월 적립, 엔진오일 교체':'예) 점심, 기본급')+'" value="'+esc(e.n)+'" autocomplete="off">';
  const rec=(isFund?[]:recentNames(e.type));
  if(rec.length&&!edit) h+='<div class="quick">'+rec.map(n=>'<button type="button" data-en="'+esc(n)+'">'+esc(n)+'</button>').join('')+'</div>';
  h+='</div>';
  const cats=isFund?FUNDS.map(f=>({id:f.id,name:f.name})):CATS[e.type];
  h+='<div class="fld"><span class="lb">'+(isFund?'예비 통장':isSet?'누구와':'분류')+'</span><div class="chips">'+cats.map(c=>'<button type="button" class="chip'+(e.c===c.id?' on':'')+'" data-ec="'+esc(c.id)+'">'+esc(c.name)+'</button>').join('')+'</div></div>';
  if(isFund||isSet){
    const lab=isFund?[['in','입금'],['out','출금']]:[['in','받음'],['out','보냄']];
    h+='<div class="fld"><span class="lb">방향</span><div class="chips">'+lab.map(l=>'<button type="button" class="chip'+(e.k===l[0]?' on':'')+'" data-ek="'+l[0]+'">'+l[1]+'</button>').join('')+'</div></div>';
  }
  h+='<div class="fld"><span class="lb">날짜</span><div class="row-flex" style="flex-wrap:wrap"><div class="stepper"><button type="button" data-dd="-1" aria-label="하루 전">−</button><span class="val">'+(e.d?mv+'월 '+e.d+'일':'날짜 미정')+'</span><button type="button" data-dd="1" aria-label="하루 뒤">+</button></div>'+
    '<div class="quick" style="margin:0">'+(isCur(y,mv)?'<button type="button" data-dset="today">오늘</button>':'')+(isFund?'':'<button type="button" data-dset="none">미정</button>')+'</div></div></div>';
  h+='<div class="fld"><label for="ed-m">메모 (선택)</label><input id="ed-m" class="inp" value="'+esc(e.m)+'" autocomplete="off"></div>';
  // 더 보기
  h+='<div class="more"><button type="button" class="link" data-more>'+(e.more?'접기 ▴':'더 보기 ▾')+'</button>';
  if(e.more){
    if(e.type==='out'){
      h+='<div class="fld"><label for="ed-fd">예비로 충당</label><select id="ed-fd" class="inp"><option value="">충당 안 함</option>'+FUNDS.map(f=>'<option value="'+esc(f.id)+'"'+(e.fd===f.id?' selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></div>'+
        (e.fd?'<div class="fld"><label for="ed-fa">충당 금액 (비우면 전액)</label><input id="ed-fa" class="inp num" inputmode="numeric" value="'+esc(e.fa)+'"></div>':'')+
        '<div class="fld"><label for="ed-sp">송금으로 냈어요 (정산 보냄 연동)</label><select id="ed-sp" class="inp"><option value="">아니요</option>'+CATS.settle.map(c=>'<option value="'+esc(c.id)+'"'+(e.sp===c.id?' selected':'')+'>'+esc(c.name)+'에게 송금</option>').join('')+'</select></div>';
    }
    if(isFund&&e.k==='in') h+='<label class="opt"><input type="checkbox" id="ed-o"'+(e.o?' checked':'')+'> 기존 잔액으로 넣기 (월 수지에 넣지 않아요)</label>';
    if(isFund&&e.k==='out') h+='<label class="opt"><input type="checkbox" id="ed-cv"'+(e.cv?' checked':'')+'> 적자 보전으로 쓰기 (그 달 남는 금액에 더해져요)</label>';
    if(edit&&!e.fid) h+='<div class="fld"><label for="ed-mv">다른 달로 옮기기</label><select id="ed-mv" class="inp">'+M12.map(x=>'<option value="'+x+'"'+(x===mv?' selected':'')+'>'+x+'월</option>').join('')+'</select></div>';
    if(!edit&&e.type==='out'){
      h+='<label class="opt"><input type="checkbox" id="ed-inst"'+(e.inst?' checked':'')+'> 할부로 등록 (몇 월부터 몇 월까지 같은 금액)</label>';
      if(e.inst){
        const keys=[];for(let i=-1;i<40;i++) keys.push(idxKey(ymIdx(mkey(y,m))+i));
        const opts=sel=>keys.map(k=>'<option value="'+k+'"'+(k===sel?' selected':'')+'>'+k.slice(0,4)+'년 '+Number(k.slice(5))+'월</option>').join('');
        const n=ymIdx(e.ie)-ymIdx(e.is)+1;
        h+='<div class="fld"><label>몇 월부터</label><select id="ed-is" class="inp">'+opts(e.is)+'</select></div><div class="fld"><label>몇 월까지</label><select id="ed-ie" class="inp">'+opts(e.ie)+'</select><div class="sub" style="margin-top:4px">'+(n>=1?'총 '+n+'회':'끝이 시작보다 빨라요')+'</div></div>';
      }
    }
  }
  h+='</div><div class="foot"><button type="button" class="btn soft" data-close>닫기</button>'+(edit?'<button type="button" class="btn danger" data-del>삭제</button><button type="button" class="btn soft" data-dup>복제</button>':'')+'<button type="button" class="btn fill" data-save>저장</button></div>';
  return h;
}
function edRender(){sheetRender(edHTML())}
function edSave(){
  const e=UI.ED,y=S.year,m=S.view,a=num(e.a);
  if(!a){toast('금액을 입력해 주세요');return}
  if(e.type==='fund') return edSaveFund(a);
  if(e.mode==='add'&&e.inst&&e.type==='out') return edSaveInst(a);
  const md=ensureYear(y)[m],old=e.id?md.tx.find(x=>x.id===e.id):null;
  const target=(e.mode==='edit'&&e.mv&&e.mv!==m)?e.mv:m;
  const tx={id:e.id||newId(),d:Math.min(e.d||0,daysIn(y,target)),t:e.type,c:e.c,n:e.n.trim(),a:a,m:e.m.trim()};
  if(old&&old.fx) tx.fx=old.fx;
  if(e.type==='settle') tx.k=e.k==='out'?'out':'in';
  if(e.type==='out'&&e.sp&&findCat('settle',e.sp)) tx.sp=e.sp;
  if(e.type==='out'&&e.fd&&FUNDS.some(f=>f.id===e.fd)){tx.fd=e.fd;tx.fa=Math.min(num(e.fa)||a,a)}
  const s=snap(target!==m?[m,target]:[m]);
  if(e.mode==='edit'){
    if(target!==m){md.tx=md.tx.filter(x=>x.id!==e.id);ensureYear(y)[target].tx.push(tx);saveMonth(y,target)}
    else{const i=md.tx.findIndex(x=>x.id===e.id);if(i>=0) md.tx[i]=tx}
  }else md.tx.push(tx);
  saveMonth(y,m);UI.lastC[e.type]=e.c;
  layerClose();render(true);
  toast(target!==m?'내역을 '+target+'월로 옮겼어요':(e.mode==='edit'?'수정했어요':'기록했어요'),()=>restore(s));
}
function edSaveFund(a){
  const e=UI.ED,y=S.year,m=S.view,f=FUNDS.find(x=>x.id===e.c);
  if(!f){toast('예비 통장을 골라 주세요');return}
  const s=snap();
  let rec={id:e.id||newId(),k:e.k==='out'?'out':'in',y:y,m:m,d:Math.max(1,e.d||1),a:a,n:e.n.trim()};
  if(e.m.trim()) rec.r=e.m.trim();
  if(rec.k==='in'&&e.o) rec.o=true;
  if(rec.k==='out'&&e.cv) rec.cv=true;
  if(e.mode==='edit'&&e.fid){const of=FUNDS.find(x=>x.id===e.fid);if(of) of.tx=of.tx.filter(x=>x.id!==e.id)}
  f.tx.push(rec);saveCfg();layerClose();render(true);
  toast(e.mode==='edit'?'수정했어요':'기록했어요',()=>restore(s));
}
function edSaveInst(a){
  const e=UI.ED,y=S.year,m=S.view,sk=e.is,cnt=ymIdx(e.ie)-ymIdx(sk)+1;
  if(cnt<1){toast('끝나는 달이 시작하는 달보다 빨라요');return}
  const s=snap(),curKey=mkey(y,m),name=e.n.trim()||catName('out',e.c)+' 할부',fid='fx'+newId();
  FIXED.push({id:fid,name:name,t:'out',k:'',cat:e.c,day:e.d||0,sched:[{from:sk,amt:a}],count:cnt,start:sk,show:sk>curKey?sk:curKey,fd:'',fa:0,sp:e.sp||'',auto:false});
  if(curKey>=sk&&ymIdx(curKey)<=ymIdx(sk)+cnt-1){
    ensureYear(y)[m].tx.push({id:newId(),d:Math.min(e.d||0,daysIn(y,m)),t:'out',c:e.c,n:name,a:a,m:e.m.trim(),fx:fid});
    saveMonth(y,m);
  }
  saveCfg();UI.lastC.out=e.c;layerClose();render(true);
  toast('할부 '+cnt+'회로 등록했어요. 다른 달은 확정 대기에 나와요',()=>{FIXED=FIXED.filter(x=>x.id!==fid);restore(s)});
}
function edDelete(){
  const e=UI.ED,s=snap();
  if(e.fid){const f=FUNDS.find(x=>x.id===e.fid);if(f) f.tx=f.tx.filter(x=>x.id!==e.id);saveCfg()}
  else{const md=ensureYear(S.year)[S.view];md.tx=md.tx.filter(x=>x.id!==e.id);saveMonth(S.year,S.view)}
  layerClose();render(true);toast('삭제했어요',()=>restore(s));
}
function edDup(){
  const e=UI.ED,s=snap();
  if(e.fid){
    const f=FUNDS.find(x=>x.id===e.fid),t=f&&f.tx.find(x=>x.id===e.id);if(!t) return;
    f.tx.push(Object.assign({},t,{id:newId()}));saveCfg();
  }else{
    const md=ensureYear(S.year)[S.view],t=md.tx.find(x=>x.id===e.id);if(!t) return;
    const c=Object.assign({},t,{id:newId()});delete c.fx;md.tx.push(c);saveMonth(S.year,S.view);
  }
  layerClose();render(true);toast('복제했어요',()=>restore(s));
}

/* ───── 사진으로 입력 ───── */
function startPhoto(gallery){
  UI.fab=false;render(true);
  const inp=$(gallery?'#photo-in2':'#photo-in');inp.value='';inp.click();
}
async function onPhoto(file){
  if(!file) return;
  toast('사진을 읽는 중이에요…');
  try{const r=await Photo.analyze(file,isoToday(),msg=>toast(msg));openPhotoSheet(r)}
  catch(err){toast(err&&err.message?err.message:'사진을 읽지 못했어요')}
}
function payDay(){
  const src=prevPayMonth(S.year,S.view);
  if(src){const t=ensureYear(src.y)[src.m].tx.find(x=>x.t==='in'&&x.d);if(t) return t.d}
  return 17;
}
function phRows(items,slip){
  return items.map(it=>{
    const type=it.type==='in'?'in':(it.type==='ded'?'ded':'out');
    const cat=CATS[type].find(c=>c.name===it.c||c.id===it.c)||CATS[type].find(c=>c.id===OTHER[type]);
    let mo=S.view,d=slip?Math.min(payDay(),daysIn(S.year,S.view)):(isCur(S.year,S.view)?NOW.getDate():1);
    const dm=it.date&&/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(it.date));
    if(dm&&Number(dm[1])===S.year){mo=Number(dm[2]);d=Number(dm[3])}
    return {on:true,mo:mo,d:d,n:String(it.n||''),a:won(Number(it.a)||0),k:type+'|'+cat.id};
  });
}
function openPhotoSheet(r){
  UI.PH={mode:r.mode,note:r.note||'',text:r.text||'',thumb:r.thumb,info:r.info||null,tries:r.tries||1,rows:phRows(r.items,!!(r.info&&r.info.slip))};
  layerOpen(phHTML());
}
function phHTML(){
  const p=UI.PH;
  const opts=sel=>['out','in','ded'].map(ty=>'<optgroup label="'+TL[ty]+'">'+CATS[ty].map(c=>'<option value="'+ty+'|'+esc(c.id)+'"'+(sel===ty+'|'+c.id?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'</optgroup>').join('');
  let h='<h2>사진에서 읽은 내역</h2>';
  if(p.mode==='mock') h+='<p class="sub" style="background:var(--tint-warn);padding:6px 10px;border-radius:8px">미리보기 화면이라 예시 결과를 보여 줘요. 폰에 설치한 앱에서는 사진을 실제로 읽어요.</p>';
  else if(p.mode==='ocr') h+='<p class="sub" style="background:var(--tint-warn);padding:6px 10px;border-radius:8px">폰 안에서 글자를 읽은 결과예요. 글자를 잘못 읽을 수 있으니 <b>날짜와 금액을 꼭 확인</b>하고 고쳐 주세요. (더보기 → 사진 분석에서 API 키를 넣으면 더 정확해요)'+(p.note?'<br>'+esc(p.note):'')+'</p>';
  else h+='<p class="sub">잘못 읽은 곳은 고친 뒤에 등록하세요.</p>';
  const info=p.info;
  if(info&&info.slip){
    const t=info.tot,f=n=>won(n)+'원';
    h+='<div class="card" style="padding:10px 12px;margin:6px 0"><b>월급 명세서로 읽었어요</b><div class="sub" style="margin-top:2px">급여총액 '+f(t.gross)+' · 세금·공제 '+f(t.tax+t.ded)+' · 실수령액 '+f(t.net)+(p.tries>1?' · '+p.tries+'번 읽었어요':'')+'</div>'+
      (info.ok?'<div style="margin-top:4px;color:var(--save)">✔ 항목을 더한 값이 총액과 맞아요</div>':'<div style="margin-top:4px;color:var(--over)">⚠ '+info.warns.map(esc).join('<br>⚠ ')+'<br>빠졌거나 잘못 읽은 항목이 있어요. 아래 금액을 명세서와 비교해 고쳐 주세요.</div>')+'</div>';
    const have=ensureYear(S.year)[S.view].tx.filter(x=>x.t==='in'||x.t==='ded').length;
    if(have) h+='<p class="sub" style="color:var(--over)">'+S.view+'월에 이미 수입·공제가 '+have+'건 있어요. 등록하면 같은 항목이 두 번 들어가니, 필요하면 먼저 지우세요.</p>';
  }
  if(p.thumb) h+='<img src="'+p.thumb+'" alt="찍은 사진" style="max-width:100%;max-height:140px;border-radius:8px;border:1px solid var(--rule);display:block;margin:6px 0">';
  if(p.mode==='ocr'&&p.text&&p.text.trim()&&p.rows.length) h+='<details style="margin:4px 0"><summary class="link">읽은 글자 보기</summary><pre style="white-space:pre-wrap;font-size:12.5px;background:var(--paper2);padding:8px;border-radius:8px;max-height:30vh;overflow:auto">'+esc(p.text.trim())+'</pre><button type="button" class="btn sm" data-phpaste>이 글자로 붙여넣어 입력</button></details>';
  if(!p.rows.length){
    h+='<p class="empty" style="font-size:20px">읽을 수 있는 내역이 없었어요.<br>사진을 더 가깝고 밝게 찍어 보세요.</p>';
    if(p.text&&p.text.trim()) h+='<details open style="margin:6px 0"><summary class="link">읽은 글자 보기</summary><pre style="white-space:pre-wrap;font-size:12.5px;background:var(--paper2);padding:8px;border-radius:8px;max-height:30vh;overflow:auto">'+esc(p.text.trim())+'</pre></details><button type="button" class="btn sm" data-phpaste>이 글자로 붙여넣어 입력</button>';
  }
  p.rows.forEach((r,i)=>{
    h+='<div class="pp" data-pi="'+i+'"><input type="checkbox" class="ph-on"'+(r.on?' checked':'')+' aria-label="등록"><div class="row-flex"><input class="inp ph-d" style="width:62px;min-height:40px;padding:4px 8px" inputmode="numeric" value="'+r.d+'" aria-label="일"><input class="inp ph-n" style="min-height:40px;padding:4px 8px" value="'+esc(r.n)+'" aria-label="내용"></div>'+
      '<input class="inp ph-a num" style="width:108px;min-height:40px;padding:4px 8px;text-align:right" inputmode="numeric" value="'+esc(r.a)+'" aria-label="금액"><select class="ph-k" aria-label="분류">'+opts(r.k)+'</select></div>';
  });
  const n=p.rows.filter(r=>r.on&&num(r.a)).length;
  h+='<div class="foot"><button type="button" class="btn soft" data-close>닫기</button><button type="button" class="btn fill" data-phsave'+(n?'':' disabled')+'>'+n+'건 등록</button></div>';
  return h;
}
function phSave(){
  const p=UI.PH;if(!p) return;
  const rows=p.rows.filter(r=>r.on&&num(r.a));if(!rows.length) return;
  const touched={},s=snap(M12.slice());
  rows.forEach(r=>{
    const k=r.k.indexOf('|'),ty=r.k.slice(0,k),c=r.k.slice(k+1),mo=r.mo||S.view;
    ensureYear(S.year)[mo].tx.push({id:newId(),d:Math.min(r.d||0,daysIn(S.year,mo)),t:ty,c:c,n:r.n.trim(),a:num(r.a),m:'사진으로 입력'});touched[mo]=1;
  });
  Object.keys(touched).forEach(m=>saveMonth(S.year,Number(m)));
  layerClose();render(true);toast(rows.length+'건을 등록했어요',()=>restore(s));
}

/* ───── 예산 수정 시트 / 근거 보기 시트 / 사용자 시트 ───── */
function openBudgetSheet(id){
  const y=S.year,m=S.view,st=monthStats(y,m);
  const typed=st.typedMap[id]||0,fixv=st.fixMap[id]||0,a=st.catNet[id]||0;
  UI.BS={id:id,v:typed?won(typed):''};
  layerOpen('<h2>'+esc(catName('out',id))+' 변동 예산</h2><p class="sub">'+m+'월부터 이어서 적용돼요. '+(fixv?'고정 '+money(fixv)+'은 따로 더해져요. ':'')+'이번 달 쓴 금액은 '+money(a)+'이에요.</p>'+
    '<div class="fld"><label for="bs-v">변동 예산 (원)</label><input id="bs-v" class="inp amount num" inputmode="numeric" placeholder="0" value="'+esc(UI.BS.v)+'"><div class="quick">'+[['10000','+1만'],['50000','+5만'],['100000','+10만']].map(q=>'<button type="button" data-bq="'+q[0]+'">'+q[1]+'</button>').join('')+'<button type="button" data-bq="clear">지우기</button></div></div>'+
    '<div class="foot"><button type="button" class="btn soft" data-close>닫기</button><button type="button" class="btn fill" data-bsave>저장</button></div>');
}
function openDrill(key){
  const d=drillData(key),fm=d.signed?sg:money;let total=0,h='<h2>'+esc(d.title)+' <span class="sub">'+S.view+'월</span></h2><p class="sub">눌러서 고칠 수 있어요. 연한 줄은 아직 확정하지 않은 예정이에요.</p>';
  d.rows.forEach(r=>{
    total+=r.a;
    h+='<div role="button" tabindex="0" class="it" '+(r.fid?'data-fit="'+esc(r.fid)+':'+esc(r.id)+'"':'data-it="'+esc(r.id)+'"')+'><span class="sub">'+(r.d||'-')+'일</span><div class="mid"><b>'+esc(r.n||r.c)+'</b><small>'+esc(r.c)+(r.note?' · '+esc(r.note):'')+'</small></div><div class="amt num">'+fm(r.a)+'</div></div>';
  });
  d.pend.forEach(r=>{
    total+=r.a;
    h+='<div class="it dim"><span class="sub">'+(r.d||'-')+'일</span><div class="mid"><b>'+esc(r.n)+'</b><small><em class="tag pend">예정</em>'+esc(r.c)+'</small></div><div class="amt num">'+fm(r.a)+'</div></div>';
  });
  if(!d.rows.length&&!d.pend.length) h+='<p class="empty">해당 내역이 없어요.</p>';
  else h+='<div class="ln total"><span>합계</span><span class="l"></span><b>'+fm(total)+'</b></div>';
  h+='<div class="foot"><button type="button" class="btn soft" data-close>닫기</button></div>';
  layerOpen(h);
}
function openWho(){
  layerOpen('<h2>사용자 바꾸기</h2><p class="sub">지금은 '+esc(Store.user)+'님의 가계부예요.</p><div class="typeseg" style="grid-template-columns:1fr 1fr">'+
    ['J','Y'].map(u=>'<button type="button" data-login="'+u+'" class="'+(Store.user===u?'on':'')+'" style="min-height:64px;font-size:24px;'+(Store.user===u?'background:var(--ink);color:var(--paper)':'')+'">'+u+'</button>').join('')+'</div>'+
    '<div class="foot"><button type="button" class="btn soft" data-close>닫기</button></div>');
}

/* ───── 동작 ───── */
function confirmFixedRow(row){
  const id=row.dataset.pid.slice(3),f=FIXED.find(x=>x.id===id),amt=num($('.pa',row).value);
  if(!f||!amt) return false;
  const t=f.t||'out',y=S.year,m=S.view,md=ensureYear(y)[m];
  const tx={id:newId(),d:f.day?Math.min(f.day,daysIn(y,m)):0,t:t,c:findCat(t,f.cat)?f.cat:OTHER[t],n:f.name,a:amt,m:'',fx:f.id};
  if(t==='settle') tx.k=f.k==='in'?'in':'out';
  if(t==='out'&&f.sp&&findCat('settle',f.sp)) tx.sp=f.sp;
  const fa=fixedFa(f,amt);if(t==='out'&&f.fd&&fa>0){tx.fd=f.fd;tx.fa=Math.min(fa,amt)}
  md.tx.push(tx);return true;
}
function confirmFundRow2(row){
  const fu=FUNDS.find(x=>x.id===row.dataset.pid.slice(3)),amt=num($('.pa',row).value);
  if(!fu||!amt) return false;
  fu.tx.push({id:newId(),k:'in',y:S.year,m:S.view,d:isCur(S.year,S.view)?Math.min(NOW.getDate(),daysIn(S.year,S.view)):1,a:amt,n:'월 적립'});
  return true;
}
function confirmRows(rows){
  const s=snap();let n=0,fx=false,fd=false;
  rows.forEach(r=>{if(r.dataset.pid.indexOf('fd:')===0){if(confirmFundRow2(r)){n++;fd=true}}else if(confirmFixedRow(r)){n++;fx=true}});
  if(fx) saveMonth(S.year,S.view);
  if(fd) saveCfg();
  if(n){render(true);toast(n+'건 확정했어요',()=>restore(s))}else toast('금액을 입력해 주세요');
}
function skipRow(row,on){
  const pid=row.dataset.pid,key=pid.indexOf('fd:')===0?pid:pid.slice(3),md=ensureYear(S.year)[S.view];
  if(on){if(md.skip.indexOf(key)<0) md.skip.push(key)}else md.skip=md.skip.filter(x=>x!==key);
  saveMonth(S.year,S.view);render(true);
}
function doSweep(){
  const emg=FUNDS.find(f=>f.name==='비상금');if(!emg) return;
  const y=S.year,m=S.view,c=chainYear(y).rows[m],net=c.past?c.net:c.netNow;if(!net) return;
  const s=snap(),cur=isCur(y,m);
  const tx={id:newId(),k:net>0?'in':'out',y:y,m:m,d:cur?NOW.getDate():daysIn(y,m),a:Math.abs(net),n:net>0?'월 남은 금액':'적자 보전'};
  if(net<0) tx.cv=true;
  emg.tx.push(tx);saveCfg();render(true);
  toast(net>0?'남은 '+money(net)+'을 비상금에 넣었어요':'적자 '+money(-net)+'을 비상금에서 보전했어요',()=>restore(s));
}
function setYear(d){
  S.year+=d;S.editId=null;loadY(S.year);render();
}
function doLogin(u){
  layerClose();Store.login(u);UI.tab='home';UI.filter='all';UI.fcat='';UI.fab=false;
  S.view=(S.year===NOW.getFullYear())?NOW.getMonth()+1:1;
  render();
}
function doExport(){
  const blob=new Blob([Store.exportJSON()],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='가계부-'+Store.user+'-'+isoToday()+'.json';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
  try{localStorage.setItem('gagyebu2.'+Store.user+'.backup',String(Date.now()))}catch(e){}
  toast('백업 파일을 저장했어요');render(true);
}

/* ───── 길게 눌러 고르기(일괄 편집) ───── */
const selIds=()=>Object.keys(UI.sel).filter(k=>UI.sel[k]);
function endSel(){UI.selMode=false;UI.sel={}}
function bulkMove(m2){
  const ids=selIds();if(!ids.length||!m2||m2===S.view) return;
  const s0=snap([S.view,m2]),md=ensureYear(S.year)[S.view],tgt=ensureYear(S.year)[m2],set=new Set(ids);
  const mv=md.tx.filter(t=>set.has(t.id));md.tx=md.tx.filter(t=>!set.has(t.id));
  mv.forEach(t=>{t.d=Math.min(t.d||0,daysIn(S.year,m2));tgt.tx.push(t)});
  saveMonth(S.year,S.view);saveMonth(S.year,m2);endSel();render(true);
  toast(mv.length+'건을 '+m2+'월로 옮겼어요',()=>restore(s0));
}
function bulkCat(val){
  const ids=selIds();if(!ids.length||!val) return;
  const k=val.indexOf('|'),ty=val.slice(0,k),cid=val.slice(k+1),s0=snap(),md=ensureYear(S.year)[S.view],set=new Set(ids);
  let n=0,skip=0;md.tx.forEach(t=>{if(!set.has(t.id)) return;if(t.t===ty){t.c=cid;n++}else skip++});
  saveMonth(S.year,S.view);endSel();render(true);
  toast(n+'건의 분류를 바꿨어요'+(skip?' ('+skip+'건은 종류가 달라 그대로예요)':''),()=>restore(s0));
}
function bulkDel(){
  const ids=selIds();if(!ids.length) return;
  const s0=snap(),md=ensureYear(S.year)[S.view],set=new Set(ids),before=md.tx.length;
  md.tx=md.tx.filter(t=>!set.has(t.id));saveMonth(S.year,S.view);endSel();render(true);
  toast((before-md.tx.length)+'건을 삭제했어요',()=>restore(s0));
}
function startLongPress(e){
  UI.lpSup=false;
  const it=e.target.closest&&e.target.closest('.it[data-it]');
  if(!it||UI.tab!=='list'||layer.className==='open') return;
  clearTimeout(UI.lp);UI.lpXY=[e.clientX,e.clientY];const id=it.dataset.it;
  UI.lp=setTimeout(()=>{UI.lp=null;UI.lpSup=true;UI.selMode=true;UI.sel[id]=true;render(true);if(navigator.vibrate){try{navigator.vibrate(15)}catch(_){}}},480);
}
const stopLongPress=()=>{clearTimeout(UI.lp);UI.lp=null};
document.addEventListener('pointerdown',startLongPress);
['pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev,stopLongPress));
document.addEventListener('pointermove',e=>{if(UI.lp&&UI.lpXY&&(Math.abs(e.clientX-UI.lpXY[0])>10||Math.abs(e.clientY-UI.lpXY[1])>10)) stopLongPress()});
document.addEventListener('scroll',stopLongPress,true);
document.addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('.it')) e.preventDefault()});

/* ───── 금액·분류만 빠르게 고치기 ───── */
function openQuick(id,mode){
  const md=ensureYear(S.year)[S.view],t=md.tx.find(x=>x.id===id);if(!t) return;
  UI.QE={id:id,mode:mode};
  const title=esc(t.n||catName(t.t,effId(t)));
  if(mode==='amt'){
    layerOpen('<h2>'+title+' <span class="sub">금액</span></h2><div class="fld"><input id="qe-a" class="inp amount num" inputmode="numeric" value="'+won(t.a)+'" aria-label="금액"><div class="quick">'+
      [['1000','+1천'],['10000','+1만'],['50000','+5만'],['100000','+10만']].map(q=>'<button type="button" data-qq="'+q[0]+'">'+q[1]+'</button>').join('')+'<button type="button" data-qq="clear">지우기</button></div></div>'+
      '<div class="foot"><button type="button" class="btn soft" data-close>닫기</button><button type="button" class="btn fill" data-qesave>저장</button></div>');
    setTimeout(()=>{const el=$('#qe-a');if(el){el.focus();if(el.select) el.select()}},60);
  }else{
    layerOpen('<h2>'+title+' <span class="sub">'+(t.t==='settle'?'누구와':'분류')+'</span></h2><p class="sub">누르면 바로 바뀌어요.</p><div class="chips" style="margin:8px 0">'+
      CATS[t.t].map(c=>'<button type="button" class="chip'+(effId(t)===c.id?' on':'')+'" data-qec="'+esc(c.id)+'">'+esc(c.name)+'</button>').join('')+'</div>'+
      '<div class="foot"><button type="button" class="btn soft" data-close>닫기</button></div>');
  }
}
function quickSave(cid){
  const q=UI.QE;if(!q) return;
  const md=ensureYear(S.year)[S.view],t=md.tx.find(x=>x.id===q.id);if(!t) return;
  const s0=snap();
  if(q.mode==='amt'){
    const a=num($('#qe-a').value);if(!a){toast('금액을 입력해 주세요');return}
    t.a=a;if(t.fa>a) t.fa=a;
  }else t.c=cid;
  saveMonth(S.year,S.view);layerClose();render(true);toast('고쳤어요',()=>restore(s0));
}

/* ───── 지난달 급여 복사 ───── */
const SPECIAL_PAY=/^정근수당$|명절|성과|연말정산/;
function prevPayMonth(y,m){
  for(let k=1;k<=24;k++){
    let yy=y,mm=m-k;while(mm<1){mm+=12;yy--}
    if(yy<FIRST_YEAR-1) break;
    if(ensureYear(yy)[mm].tx.some(t=>t.t==='in'||t.t==='ded')) return {y:yy,m:mm};
  }
  return null;
}
function copyPay(){
  const y=S.year,m=S.view,src=prevPayMonth(y,m);
  if(!src){toast('복사할 지난달 급여가 없어요');return}
  const cur=ensureYear(y)[m],have=cur.tx.filter(t=>t.t==='in'||t.t==='ded').length;
  if(have&&!confirm('이미 수입·공제가 '+have+'건 있어요. 지난달 급여를 추가로 복사할까요?')) return;
  const items=ensureYear(src.y)[src.m].tx.filter(t=>((t.t==='in'&&effId(t)!==OTHER.in)||t.t==='ded')&&!SPECIAL_PAY.test(catName(t.t,effId(t))));
  if(!items.length){toast('복사할 급여 항목이 없어요');return}
  const s0=snap();
  items.forEach(t=>{const o=Object.assign({},t,{id:newId()});delete o.fx;delete o.fd;delete o.fa;delete o.sp;o.d=Math.min(t.d||0,daysIn(y,m));cur.tx.push(o)});
  saveMonth(y,m);UI.tab='list';UI.filter='all';UI.fcat='';render();
  toast(src.m+'월 급여 '+items.length+'건을 복사했어요. 금액을 눌러 이번 달 명세서대로 고쳐 주세요',()=>restore(s0));
}

/* ───── 백업 안내 ───── */
GApp.lastBackup=function(){
  try{const v=Number(localStorage.getItem('gagyebu2.'+Store.user+'.backup'))||0;if(!v) return null;const d=Math.floor((Date.now()-v)/86400000);return {days:d,text:d===0?'오늘':d+'일 전'}}catch(e){return null}
};
GApp.backupNag=function(){
  let n=0;Object.keys(YEARS).forEach(y=>M12.forEach(m=>{n+=YEARS[y][m].tx.length}));
  if(n<10) return '';
  const lb=GApp.lastBackup();if(lb&&lb.days<14) return '';
  return '<section class="card"><b>'+(lb?'백업한 지 '+lb.days+'일 됐어요':'아직 백업한 적이 없어요')+'</b><div class="sub" style="margin:2px 0 8px">기록은 이 폰에만 저장돼요. 백업 파일을 받아 두면 폰을 바꾸거나 데이터를 지워도 되살릴 수 있어요.</div><button class="btn sm fill" type="button" data-act="export">백업하기</button></section>';
};

/* ───── 이벤트 ───── */
document.addEventListener('click',e=>{
  const t=e.target,c=s=>t.closest(s);
  if(c('[data-undo]')){const f=UI.undo;toastEl.className='toast';UI.undo=null;if(f) f();return}
  if(UI.lpSup){UI.lpSup=false;return}   // 길게 누르고 손을 뗄 때 따라오는 클릭 한 번만 무시
  for(let i=0;i<GApp.hooks.click.length;i++){if(GApp.hooks.click[i](e,c)===true) return}
  // 시트 안
  if(c('#layer')){
    if(c('.scrim')||c('.sheet [data-close]')){layerClose();return}
    const ed=UI.ED;
    if(ed){
      let b;
      if((b=c('[data-t]'))&&!b.disabled){edSetType(b.dataset.t);edRender();return}
      if(b=c('[data-ec]')){ed.c=b.dataset.ec;edRender();return}
      if(b=c('[data-ek]')){ed.k=b.dataset.ek;if(ed.type==='fund'){ed.o=false;ed.cv=false}edRender();return}
      if(b=c('[data-en]')){
        ed.n=b.dataset.en;const l=lastByName(ed.type,ed.n);
        if(l){ed.c=effId(l);if(!num(ed.a)) ed.a=won(l.a)}
        edRender();return;
      }
      if(b=c('[data-qa]')){ed.a=b.dataset.qa==='clear'?'':won(num(ed.a)+Number(b.dataset.qa));edRender();return}
      if(b=c('[data-dd]')){const dim=daysIn(S.year,ed.mv||S.view),min=ed.type==='fund'?1:0;ed.d=Math.max(min,Math.min(dim,(ed.d||0)+Number(b.dataset.dd)));edRender();return}
      if(b=c('[data-dset]')){ed.d=b.dataset.dset==='today'?NOW.getDate():0;edRender();return}
      if(c('[data-more]')){ed.more=!ed.more;edRender();return}
      if(c('[data-save]')){edSave();return}
      if(c('[data-del]')){edDelete();return}
      if(c('[data-dup]')){edDup();return}
    }
    if(UI.PH){
      if(c('[data-phsave]')){phSave();return}
      if(c('[data-phpaste]')){const t=UI.PH.text;layerClose();if(GApp.openPaste) GApp.openPaste(t);return}
    }
    if(UI.QE){
      let b;
      if(b=c('[data-qq]')){const el=$('#qe-a');el.value=b.dataset.qq==='clear'?'':won(num(el.value)+Number(b.dataset.qq));return}
      if(c('[data-qesave]')){quickSave();return}
      if(b=c('[data-qec]')){quickSave(b.dataset.qec);return}
    }
    if(UI.BS){
      let b;
      if(b=c('[data-bq]')){const el=$('#bs-v');el.value=b.dataset.bq==='clear'?'':won(num(el.value)+Number(b.dataset.bq));UI.BS.v=el.value;return}
      if(c('[data-bsave]')){
        const id=UI.BS.id,md=ensureYear(S.year)[S.view];
        if(!md.budget) md.budget=resolveBudget(S.year,S.view);
        md.budget[id]=num($('#bs-v').value);saveMonth(S.year,S.view);layerClose();render(true);toast('예산을 저장했어요');return;
      }
    }
    const lg=c('[data-login]');if(lg){doLogin(lg.dataset.login);return}
    const it=c('[data-it]');if(it){layerClose();openEditor({id:it.dataset.it});return}
    const fi=c('[data-fit]');if(fi){const p=fi.dataset.fit.split(':');layerClose();openEditor({fid:p[0],tid:p[1]});return}
    return;
  }
  // 화면
  const lg=c('[data-login]');if(lg){doLogin(lg.dataset.login);return}
  if(UI.fab&&!c('.fabmenu')&&!c('.fab')){UI.fab=false;render(true);if(!c('[data-tab],[data-act]')) return}
  let b;
  if(b=c('[data-m]')){S.view=Number(b.dataset.m);UI.filter='all';UI.fcat='';UI.showSkipped=false;endSel();render();return}
  if(b=c('[data-yr]')){setYear(Number(b.dataset.yr));return}
  if(b=c('[data-sub]')){if(b.dataset.sub) enterSub(b.dataset.sub);else leaveSub();return}
  if(b=c('[data-tab]')){
    if(UI.tab==='more'&&b.dataset.tab==='more'&&UI.sub){leaveSub();return}
    UI.tab=b.dataset.tab;UI.fab=false;endSel();if(UI.tab==='list'){UI.filter='all';UI.fcat=''}render();return;
  }
  if(c('[data-bkdel]')){bulkDel();return}
  if(c('[data-bkend]')){endSel();render(true);return}
  if(b=c('[data-sv]')){UI.sv=b.dataset.sv;render(true);return}
  if(b=c('[data-flt]')){UI.filter=b.dataset.flt;UI.fcat='';render(true);return}
  if(c('[data-fc]')){UI.fcat=c('[data-fc]').dataset.fc;render(true);return}
  if(b=c('[data-gocat]')){UI.tab='list';UI.filter='out';UI.fcat=b.dataset.gocat;render();return}
  if(b=c('[data-drill]')){openDrill(b.dataset.drill);return}
  if(b=c('[data-qe]')){const row=c('.it[data-it]');if(row&&!UI.selMode){openQuick(row.dataset.it,b.dataset.qe);return}}
  if(b=c('[data-it]')){
    if(UI.selMode){UI.sel[b.dataset.it]=!UI.sel[b.dataset.it];if(!selIds().length) endSel();render(true)}
    else openEditor({id:b.dataset.it});
    return;
  }
  if(b=c('[data-fit]')){if(UI.selMode) return;const p=b.dataset.fit.split(':');openEditor({fid:p[0],tid:p[1]});return}
  if(b=c('[data-bud]')){openBudgetSheet(b.dataset.bud);return}
  if(c('[data-confirm]')){confirmRows([c('.pr')]);return}
  if(c('[data-confirmall]')){confirmRows($$('.pr').filter(r=>$('[data-confirm]',r)));return}
  if(c('[data-skip]')){skipRow(c('.pr'),true);return}
  if(c('[data-unskip]')){skipRow(c('.pr'),false);return}
  if(c('[data-showskip]')){UI.showSkipped=!UI.showSkipped;render(true);return}
  if(c('[data-pendtoggle]')){UI.pendOpen=!UI.pendOpen;render(true);return}
  if(c('[data-sweep]')){doSweep();return}
  if(b=c('[data-act]')){
    const a=b.dataset.act;
    if(a==='fab'){UI.fab=!UI.fab;render(true)}
    else if(a==='add'){UI.fab=false;render(true);openEditor()}
    else if(a==='photo') startPhoto(false);
    else if(a==='gallery') startPhoto(true);
    else if(a==='paste'){UI.fab=false;render(true);if(GApp.openPaste) GApp.openPaste()}
    else if(a==='search'){if(GApp.openSearch) GApp.openSearch()}
    else if(a==='copypay') copyPay();
    else if(a==='addin'){openEditor({type:'in'})}
    else if(a==='who') openWho();
    else if(a==='export') doExport();
    else if(a==='import') $('#import-in').click();
    else if(a==='seed'){if(confirm('지금 기록이 지워지고 체험 데이터가 들어가요. 계속할까요?')){Store.wipe();Demo.seed();S.view=isCur(S.year,S.view)?S.view:NOW.getMonth()+1;UI.tab='home';UI.sub='';render();toast('예시 데이터를 넣었어요')}}
    else if(a==='wipe'){if(confirm('이 사용자의 기록을 모두 지울까요? 되돌릴 수 없어요.')){Store.wipe();UI.sub='';render();toast('모두 지웠어요')}}
    return;
  }
});
document.addEventListener('input',e=>{
  const t=e.target;
  for(let i=0;i<GApp.hooks.input.length;i++){if(GApp.hooks.input[i](e)===true) return}
  if(t.id==='qe-a'){const v=num(t.value);t.value=v?won(v):'';return}
  if(t.id==='ed-a'&&UI.ED){const v=num(t.value);UI.ED.a=v?won(v):'';t.value=UI.ED.a;return}
  if(t.id==='ed-n'&&UI.ED){UI.ED.n=t.value;return}
  if(t.id==='ed-m'&&UI.ED){UI.ED.m=t.value;return}
  if(t.id==='ed-fa'&&UI.ED){const v=num(t.value);UI.ED.fa=v?won(v):'';t.value=UI.ED.fa;return}
  if(t.id==='bs-v'&&UI.BS){const v=num(t.value);UI.BS.v=v?won(v):'';t.value=UI.BS.v;return}
  if(t.classList&&t.classList.contains('pa')){const v=num(t.value);t.value=v?won(v):''}
  if(UI.PH){
    const row=t.closest&&t.closest('.pp');if(!row) return;
    const r=UI.PH.rows[Number(row.dataset.pi)];if(!r) return;
    if(t.classList.contains('ph-d')) r.d=Math.max(0,Math.min(31,num(t.value)));
    else if(t.classList.contains('ph-n')) r.n=t.value;
    else if(t.classList.contains('ph-a')){const v=num(t.value);r.a=v?won(v):'';t.value=r.a}
  }
});
document.addEventListener('change',e=>{
  const t=e.target,ed=UI.ED;
  for(let i=0;i<GApp.hooks.change.length;i++){if(GApp.hooks.change[i](e)===true) return}
  if(t.id==='bk-mv'){bulkMove(Number(t.value));return}
  if(t.id==='bk-cat'){bulkCat(t.value);return}
  if(ed){
    if(t.id==='ed-fd'){ed.fd=t.value;if(!t.value) ed.fa='';edRender();return}
    if(t.id==='ed-sp'){ed.sp=t.value;return}
    if(t.id==='ed-mv'){ed.mv=Number(t.value);ed.d=Math.min(ed.d,daysIn(S.year,ed.mv));edRender();return}
    if(t.id==='ed-is'){ed.is=t.value;edRender();return}
    if(t.id==='ed-ie'){ed.ie=t.value;edRender();return}
    if(t.id==='ed-o'){ed.o=t.checked;return}
    if(t.id==='ed-cv'){ed.cv=t.checked;return}
    if(t.id==='ed-inst'){ed.inst=t.checked;edRender();return}
  }
  if(UI.PH){
    const row=t.closest&&t.closest('.pp');if(!row) return;
    const r=UI.PH.rows[Number(row.dataset.pi)];if(!r) return;
    if(t.classList.contains('ph-on')){r.on=t.checked;sheetRender(phHTML())}
    else if(t.classList.contains('ph-k')) r.k=t.value;
    return;
  }
  if(t.id==='photo-in'||t.id==='photo-in2'){onPhoto(t.files&&t.files[0]);return}
  if(t.id==='import-in'){
    const f=t.files&&t.files[0];if(!f) return;
    const r=new FileReader();
    r.onload=()=>{try{Store.importJSON(String(r.result));loadY(S.year);render();toast('백업 파일을 가져왔어요')}catch(err){toast(err.message||'파일을 읽지 못했어요')}};
    r.readAsText(f);t.value='';
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&layer.className==='open'){layerClose();return}
  if((e.key==='Enter'||e.key===' ')&&e.target&&e.target.matches&&e.target.matches('[role=button]')){e.preventDefault();e.target.click()}
});

/* ───── 시작 ───── */
const ph=document.createElement('input');ph.type='file';ph.id='photo-in';ph.accept='image/*';ph.setAttribute('capture','environment');ph.hidden=true;document.body.appendChild(ph);
const ph2=document.createElement('input');ph2.type='file';ph2.id='photo-in2';ph2.accept='image/*';ph2.hidden=true;document.body.appendChild(ph2);
const im=document.createElement('input');im.type='file';im.id='import-in';im.accept='application/json,.json';im.hidden=true;document.body.appendChild(im);
Object.assign(GApp,{UI:UI,S:S,render:render,toast:toast,layerOpen:layerOpen,sheetRender:sheetRender,layerClose:layerClose,snap:snap,restore:restore,openEditor:openEditor,itemHTML:itemHTML,
  money:money,sg:sg,cls:cls,isCur:isCur,loadY:loadY,$:$,$$:$$,enterSub:enterSub,leaveSub:leaveSub,copyPay:copyPay,openQuick:openQuick,isoToday:isoToday,TL:TL,HUES:HUES,endSel:endSel,
  goto:function(y,m){S.year=y;S.view=m;UI.tab='list';UI.filter='all';UI.fcat='';endSel();loadY(y);render()},
  boot:function(){
    Store.persist();
    const last=Store.lastUser();
    if(last==='J'||last==='Y') Store.login(last);
    render();
    if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)&&location.hostname!=='localhost'&&!window.__PREVIEW__){
      navigator.serviceWorker.register('sw.js').catch(function(){});
    }
  }
});
window.__APP__=GApp;
})();
