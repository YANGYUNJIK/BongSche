/* 설정 화면 — 고정 지출·할부, 예비 통장, 추가 수입·특별 수입 일정, 정산 사람, 분류 편집 */
(function(){
"use strict";
const G=GApp,UI=G.UI,$=G.$,TL=G.TL,money=G.money,sg=G.sg;
const Z={ct:'out',FD:null,FX:null,EV:null};
G.hooks.close.push(function(){Z.FD=null;Z.FX=null;Z.EV=null});
const startKey=()=>NOW.getFullYear()<FIRST_YEAR?mkey(FIRST_YEAR,1):mkey(NOW.getFullYear(),NOW.getMonth()+1);
const viewKey=()=>mkey(S.year,S.view);
const keyText=k=>k.slice(0,4)+'년 '+Number(k.slice(5))+'월';
const keyOpts=(sel,from,n)=>{let h='';for(let i=0;i<n;i++){const k=idxKey(ymIdx(from)+i);h+='<option value="'+k+'"'+(k===sel?' selected':'')+'>'+keyText(k)+'</option>'}return h};
const rangeFrom=()=>mkey(FIRST_YEAR,1);
const changed=()=>{saveCfg();G.render(true)};
const rowHTML=(attr,title,sub,right,extra)=>'<div class="it'+(extra||'')+'" role="button" tabindex="0" '+attr+'><div class="mid"><b>'+title+'</b>'+(sub?'<small>'+sub+'</small>':'')+'</div>'+(right?'<div class="amt num">'+right+'</div>':'<span class="sub">›</span>')+'</div>';

/* ───── 분류 편집 / 정산 사람 ───── */
function catListHTML(type){
  const list=CATS[type];
  let h='<div class="card" style="padding:6px 10px">';
  list.forEach((c,i)=>{
    const pinned=c.id===OTHER[type];
    h+='<div class="crow" data-cid="'+esc(c.id)+'"><span class="dotc" style="background:'+(type==='out'?outColor(c.id):typeColor(type))+'"></span>'+
      (pinned?'<span class="cname">'+esc(c.name)+'</span><span class="sub">맨 아래 고정</span>':
        '<input class="inp cname-in" value="'+esc(c.name)+'" maxlength="20" aria-label="분류 이름"><button type="button" class="icon" data-cmove="-1" aria-label="위로"'+(i===0?' disabled':'')+'>↑</button><button type="button" class="icon" data-cmove="1" aria-label="아래로"'+(i>=list.length-2?' disabled':'')+'>↓</button><button type="button" class="btn sm danger" data-cdel>삭제</button>')+'</div>';
  });
  h+='</div><div class="row-flex" style="margin-top:10px"><input id="c-new" class="inp" maxlength="20" placeholder="새 이름" aria-label="새 이름" style="flex:1"><button type="button" class="btn fill" data-cadd="'+type+'">추가</button></div>'+
    '<p class="sub" style="margin:8px 2px">새 항목은 "'+OTHER[type]+'" 바로 위에 들어가요. 지운 항목의 내역은 "'+OTHER[type]+'"로 합쳐서 보여요.</p>';
  return h;
}
G.subs.cats={title:'분류 편집',html:function(){
  const tabs=[['out','지출'],['in','수입'],['ded','공제'],['save','저축']];
  if(!tabs.some(t=>t[0]===Z.ct)) Z.ct='out';
  return '<div class="seg">'+tabs.map(t=>'<button type="button" class="chip'+(Z.ct===t[0]?' on':'')+'" data-ctab="'+t[0]+'">'+t[1]+'</button>').join('')+'</div>'+catListHTML(Z.ct);
}};
G.subs.people={title:'정산 사람',html:function(){
  const tot={};
  M12.forEach(m=>ensureYear(S.year)[m].tx.forEach(t=>{if(t.t!=='settle') return;const id=effId(t);(tot[id]=tot[id]||{in:0,out:0})[t.k==='out'?'out':'in']+=t.a}));
  let h='<p class="sub" style="margin:0 2px 8px">'+S.year+'년에 주고받은 돈이에요. 받은 돈은 수입이 아니고, 보낸 돈은 지출이 아니에요.</p><div class="card" style="padding:6px 10px">';
  CATS.settle.forEach(c=>{const x=tot[c.id]||{in:0,out:0},d=x.in-x.out;h+='<div class="ln"><span>'+esc(c.name)+'</span><span class="l"></span><b class="'+(d<0?'neg':(d>0?'pos':''))+'">'+(d?sg(d):'0원')+'</b></div><div class="sub" style="margin:-2px 0 4px">받음 '+money(x.in)+' · 보냄 '+money(x.out)+'</div>'});
  return h+'</div><h2 class="sec">이름 고치기</h2>'+catListHTML('settle');
}};
function catRename(input){
  const row=input.closest('.crow'),id=row.dataset.cid,type=UI.sub==='people'?'settle':Z.ct,c=findCat(type,id);if(!c) return;
  const name=input.value.trim().slice(0,20);
  if(!name){input.value=c.name;return}
  if(name===c.name) return;
  if(CATS[type].some(x=>x.id!==id&&x.name.toLowerCase()===name.toLowerCase())){input.value=c.name;G.toast('같은 이름이 이미 있어요');return}
  c.name=name;changed();G.toast('이름을 바꿨어요');
}
function catAdd(type){
  const inp=$('#c-new'),name=(inp.value||'').trim().slice(0,20);
  if(!name){inp.focus();return}
  if(CATS[type].some(x=>x.name.toLowerCase()===name.toLowerCase())){G.toast('같은 이름이 이미 있어요');return}
  if(CATS[type].length>=30){G.toast('30개까지 만들 수 있어요');return}
  CATS[type].splice(CATS[type].length-1,0,{id:'c'+newId(),name:name,h:type==='out'?newHue():0});
  changed();G.toast('"'+name+'"을(를) 추가했어요');
}
function catMove(row,dir){
  const type=UI.sub==='people'?'settle':Z.ct,list=CATS[type],i=list.findIndex(c=>c.id===row.dataset.cid),j=i+dir;
  if(i<0||j<0||j>list.length-2) return;
  const t=list[i];list[i]=list[j];list[j]=t;changed();
}
function catDel(row){
  const type=UI.sub==='people'?'settle':Z.ct,c=findCat(type,row.dataset.cid);if(!c) return;
  if(!confirm('"'+c.name+'"을(를) 지울까요? 이 분류의 내역은 "'+OTHER[type]+'"로 합쳐서 보여요.')) return;
  CATS[type]=CATS[type].filter(x=>x.id!==c.id);changed();G.toast('지웠어요');
}

/* ───── 예비 통장 ───── */
G.subs.funds={title:'예비 통장',html:function(){
  const k=startKey();
  let h='<p class="sub" style="margin:0 2px 8px">목적별로 모아 두는 통장이에요. 월 적립은 월 수지에서 빠지고, 통장에서 낸 지출은 현금이 아니라서 월 수지에서 빠지지 않아요.</p>';
  if(!FUNDS.length) h+='<p class="empty">통장이 없어요.</p>';
  FUNDS.forEach(f=>{
    const plan=schedAmt(f.plan,k)||0;
    h+=rowHTML('data-fund="'+esc(f.id)+'"','<span class="dotc" style="background:hsl('+f.h+' 40% 46%);margin-right:6px"></span>'+esc(f.name),'월 적립 '+(plan?money(plan):'없음'),money(fundBal(f)));
  });
  return h+'<div class="row-flex" style="margin-top:12px"><input id="fn-name" class="inp" maxlength="20" placeholder="새 통장 이름" aria-label="새 통장 이름" style="flex:1"><button type="button" class="btn fill" data-fadd>만들기</button></div>';
}};
function fundSheet(){
  const f=FUNDS.find(x=>x.id===Z.FD);if(!f){G.layerClose();return}
  const k=startKey(),ents=fundEntries(f).sort((a,b)=>(b.y*12+b.m)*100+b.d-((a.y*12+a.m)*100+a.d)).slice(0,30);
  let h='<h2>'+esc(f.name)+' <span class="sub">잔액 '+money(fundBal(f))+'</span></h2>'+
    '<div class="fld"><label for="fd-nm">이름</label><input id="fd-nm" class="inp" maxlength="20" value="'+esc(f.name)+'"></div>'+
    '<div class="fld"><span class="lb">월 적립 계획 (달마다 확정 대기에 나와요)</span>'+
    (f.plan.length?f.plan.map(p=>'<div class="ln"><span>'+keyText(p.from)+'부터</span><span class="l"></span><b>'+(p.amt?money(p.amt):'중단')+'</b><button type="button" class="icon" data-fpdel="'+p.from+'" aria-label="삭제">✕</button></div>').join(''):'<div class="sub">계획이 없어요.</div>')+
    '<div class="row-flex" style="margin-top:6px;flex-wrap:wrap"><select id="fp-from" class="inp" style="flex:1 1 120px">'+keyOpts(k,rangeFrom(),60)+'</select><input id="fp-amt" class="inp num" style="flex:1 1 110px;text-align:right" inputmode="numeric" placeholder="금액 (0=중단)"><button type="button" class="btn sm fill" data-fpadd>추가</button></div></div>'+
    '<div class="row-flex" style="gap:8px;margin:8px 0"><button type="button" class="btn sm fill" data-fnew="in">입금 추가</button><button type="button" class="btn sm" data-fnew="out">출금 추가</button></div>'+
    '<div class="fld"><span class="lb">최근 입출금</span>'+(ents.length?ents.map(e=>'<div class="it'+(e.derived?' dim':'')+'" '+(e.derived?'':'role="button" tabindex="0" data-fent="'+esc(e.id)+'"')+'><span class="sub" style="flex:none;width:62px">'+String(e.y).slice(2)+'.'+e.m+'.'+e.d+'</span><div class="mid"><b>'+esc(e.n||(e.k==='in'?'입금':'출금'))+'</b><small>'+(e.o?'기존 잔액':e.cv?'적자 보전':e.r?esc(e.r):'')+'</small></div><div class="amt num '+(e.k==='in'?'fund-in':'fund-out')+'">'+(e.k==='in'?'+':MINUS)+won(e.a)+'</div></div>').join(''):'<div class="sub">내역이 없어요.</div>')+'</div>'+
    '<div class="foot"><button type="button" class="btn danger" data-fdel>통장 지우기</button><button type="button" class="btn fill" data-close>닫기</button></div>';
  G.sheetRender(h);
}
function openFund(id){Z.FD=id;G.layerOpen('');fundSheet()}
function fundAdd(){
  const inp=$('#fn-name'),name=(inp.value||'').trim().slice(0,20);
  if(!name){inp.focus();return}
  if(FUNDS.length>=12){G.toast('통장은 12개까지 만들 수 있어요');return}
  FUNDS.push({id:'f'+newId(),name:name,h:(FUNDS.length*47+160)%360,plan:[],use:[],tx:[]});changed();G.toast('"'+name+'" 통장을 만들었어요');
}
function fundDelete(){
  const f=FUNDS.find(x=>x.id===Z.FD);if(!f) return;
  if(!confirm('"'+f.name+'" 통장을 지울까요? 입출금 내역도 사라지고, 이 통장으로 충당한 지출은 일반 지출로 바뀌어요.')) return;
  Object.keys(YEARS).forEach(y=>M12.forEach(m=>{let t0=false;YEARS[y][m].tx.forEach(t=>{if(t.fd===f.id){delete t.fd;delete t.fa;t0=true}});if(t0) saveMonth(Number(y),m)}));
  FIXED.forEach(x=>{if(x.fd===f.id){x.fd='';x.fa=0}});
  FUNDS=FUNDS.filter(x=>x.id!==f.id);G.layerClose();changed();G.toast('지웠어요');
}

/* ───── 추가 수입 · 특별 수입 일정 ───── */
G.subs.income={title:'추가 수입 · 특별 수입 일정',html:function(){
  const info=regularInfo(),auto=info.avg,base=IPLAN.base>0;
  let h='<section class="card"><h2 class="sec" style="margin:0 0 4px">일반 달 실수령 예상</h2><div class="sub">급여를 입력하지 않은 달(이번 달 이후)을 예상할 때 써요.</div>'+
    '<div class="ln"><span>자동 계산'+(info.months.length?' <small class="sub">('+info.y+'년 '+info.months.length+'개월 평균)</small>':'')+'</span><span class="l"></span><b>'+(auto?money(auto):'기록 없음')+'</b></div>'+
    '<div class="row-flex" style="margin-top:6px"><input id="ip-base" class="inp num" style="text-align:right" inputmode="numeric" placeholder="직접 정하기 (예: 2,689,783)" value="'+(base?won(IPLAN.base):'')+'" aria-label="일반 달 실수령"><button type="button" class="btn sm soft" data-ipauto>자동으로</button></div>'+
    '<div class="sub" style="margin-top:6px">추가 수입(방과후 등)이 없어지는 해에는 여기에 명세서 기준 금액을 직접 적으면 예상이 정확해져요.</div></section>';
  h+='<h2 class="sec">특별 수입 일정</h2><div class="sub" style="margin:0 2px 6px">정근수당, 명절휴가비, 성과금처럼 특정 달에만 더 들어오는 돈이에요. 일반 달 평균에서 빼고, 해당 달 예상에 더해요.</div>';
  const ev=IPLAN.events.slice().sort((a,b)=>a.m-b.m||a.y-b.y);
  h+=ev.length?ev.map(e=>rowHTML('data-ev="'+esc(e.id)+'"',esc(e.name),(e.y?e.y+'년':'매년')+' '+e.m+'월',money(e.amt))).join(''):'<p class="empty" style="font-size:20px">일정이 없어요.</p>';
  h+='<button type="button" class="btn fill" style="margin-top:10px" data-evnew>+ 일정 추가</button>';
  const cy=String(FIRST_YEAR);
  h+='<section class="card" style="margin-top:16px"><h2 class="sec" style="margin:0 0 4px">'+FIRST_YEAR+'년 시작 이월</h2><div class="sub">시작할 때 통장에 이미 있는 남는 돈이에요. 없으면 비워 두세요.</div><input id="ip-carry" class="inp num" style="text-align:right;margin-top:6px" inputmode="numeric" placeholder="0" value="'+(IPLAN.carry[cy]?won(IPLAN.carry[cy]):'')+'" aria-label="시작 이월"></section>';
  return h;
}};
function evSheet(){
  const e=Z.EV,edit=!!e.id;
  const yopts='<option value="0"'+(e.y===0?' selected':'')+'>매년</option>'+[FIRST_YEAR,FIRST_YEAR+1,FIRST_YEAR+2,FIRST_YEAR+3].map(y=>'<option value="'+y+'"'+(e.y===y?' selected':'')+'>'+y+'년만</option>').join('');
  G.sheetRender('<h2>'+(edit?'일정 고치기':'특별 수입 일정 추가')+'</h2><div class="fld"><label for="ev-n">이름</label><input id="ev-n" class="inp" maxlength="24" value="'+esc(e.name)+'" placeholder="예) 정근수당, 설 명절휴가비"></div>'+
    '<div class="row-flex" style="gap:8px"><div class="fld" style="flex:1"><label for="ev-y">언제</label><select id="ev-y" class="inp">'+yopts+'</select></div><div class="fld" style="flex:1"><label for="ev-m">몇 월</label><select id="ev-m" class="inp">'+M12.map(m=>'<option value="'+m+'"'+(e.m===m?' selected':'')+'>'+m+'월</option>').join('')+'</select></div></div>'+
    '<div class="fld"><label for="ev-a">일반 달보다 더 들어오는 금액 (원, 실수령 기준)</label><input id="ev-a" class="inp amount num" inputmode="numeric" placeholder="0" value="'+(e.amt?won(e.amt):'')+'"></div>'+
    '<div class="foot"><button type="button" class="btn soft" data-close>닫기</button>'+(edit?'<button type="button" class="btn danger" data-evdel>삭제</button>':'')+'<button type="button" class="btn fill" data-evsave>저장</button></div>');
}
function openEv(id){
  const o=id?IPLAN.events.find(x=>x.id===id):null;
  Z.EV=o?{id:o.id,name:o.name,y:o.y,m:o.m,amt:o.amt}:{id:'',name:'',y:0,m:1,amt:0};
  G.layerOpen('');evSheet();
}
function evSave(){
  const e=Z.EV,name=($('#ev-n').value||'').trim().slice(0,24),amt=num($('#ev-a').value);
  if(!name||!amt){G.toast('이름과 금액을 입력해 주세요');return}
  const rec={id:e.id||'e'+newId(),name:name,y:Number($('#ev-y').value),m:Number($('#ev-m').value),amt:amt};
  if(e.id){const i=IPLAN.events.findIndex(x=>x.id===e.id);if(i>=0) IPLAN.events[i]=rec}else IPLAN.events.push(rec);
  G.layerClose();changed();G.toast('저장했어요');
}

/* ───── 고정 지출 · 할부 ───── */
const FT={out:'지출',save:'저축','settle-in':'정산 받음','settle-out':'정산 보냄'};
const ftOf=f=>f.t==='settle'?'settle-'+(f.k==='in'?'in':'out'):(f.t||'out');
G.subs.fixed={title:'고정 지출 · 할부',html:function(){
  const k=startKey();
  let h='<p class="sub" style="margin:0 2px 8px">달마다 같은 날 나가는 돈이에요. 확정 대기에 나타나고, 눌러서 확정하면 내역이 돼요. 할부는 끝나는 달을 정해요.</p>';
  if(!FIXED.length) h+='<p class="empty">고정 항목이 없어요.</p>';
  [['out','지출'],['save','저축'],['settle','정산']].forEach(g=>{
    const list=FIXED.filter(f=>(f.t||'out')===g[0]);if(!list.length) return;
    h+='<h2 class="sec">'+g[1]+'</h2>';
    list.forEach(f=>{
      const now=plannedAmt(f,k),last=f.sched.length?f.sched[f.sched.length-1].amt:0,it=instText(f,k);
      const flags=[];
      if(f.auto) flags.push('확정 없이 자동');
      if(f.fd&&f.fa) flags.push('예비 충당 '+money(f.fa));
      if(f.sp&&findCat('settle',f.sp)) flags.push(catName('settle',f.sp)+'에게 송금');
      if(f.t==='settle') flags.push(f.k==='in'?'받음':'보냄');
      const sub=(f.day?f.day+'일':'날짜 미정')+' · '+esc(catName(f.t||'out',findCat(f.t||'out',f.cat)?f.cat:OTHER[f.t||'out']))+(it?' · '+it:'')+(flags.length?' · '+flags.join(' · '):'');
      h+=rowHTML('data-fx="'+esc(f.id)+'"',esc(f.name),sub,money(now||last),now?'':' dim');
    });
  });
  return h+'<button type="button" class="btn fill" style="margin-top:12px" data-fxnew>+ 고정 항목 추가</button>';
}};
function fxEndOf(f){return (f.count>0&&fxStart(f))?idxKey(ymIdx(fxStart(f))+f.count-1):''}
function openFx(id){
  const f=id?FIXED.find(x=>x.id===id):null,vk=viewKey();
  Z.FX=f?{id:f.id,name:f.name,t:f.t||'out',k:f.k||'in',cat:findCat(f.t||'out',f.cat)?f.cat:OTHER[f.t||'out'],day:f.day,amt:'',start:fxStart(f)||vk,end:fxEndOf(f),fd:f.fd||'',fa:f.fa?won(f.fa):'',sp:f.sp||'',auto:!!f.auto,sched:JSON.parse(JSON.stringify(f.sched))}
    :{id:'',name:'',t:'out',k:'in',cat:CATS.out[0].id,day:1,amt:'',start:vk,end:'',fd:'',fa:'',sp:'',auto:false,sched:[]};
  G.layerOpen('');fxSheet();
}
function fxSheet(){
  const x=Z.FX,edit=!!x.id,ty=ftOf(x),tkey=x.t==='settle'?'settle':x.t;
  let h='<h2>'+(edit?'고정 항목 고치기':'고정 항목 추가')+'</h2>'+
    '<div class="fld"><label for="fx-n">이름</label><input id="fx-n" class="inp" maxlength="24" value="'+esc(x.name)+'" placeholder="예) 친목회비, 의류 할부"></div>'+
    '<div class="fld"><span class="lb">종류</span><div class="chips">'+Object.keys(FT).map(k=>'<button type="button" class="chip'+(ty===k?' on':'')+'" data-fxt="'+k+'">'+FT[k]+'</button>').join('')+'</div></div>'+
    '<div class="fld"><span class="lb">'+(x.t==='settle'?'누구와':'분류')+'</span><div class="chips">'+CATS[tkey].map(c=>'<button type="button" class="chip'+(x.cat===c.id?' on':'')+'" data-fxc="'+esc(c.id)+'">'+esc(c.name)+'</button>').join('')+'</div></div>'+
    '<div class="fld"><span class="lb">매달 며칠 (0이면 날짜 미정)</span><div class="stepper"><button type="button" data-fxd="-1" aria-label="하루 전">−</button><span class="val">'+(x.day?x.day+'일':'미정')+'</span><button type="button" data-fxd="1" aria-label="하루 뒤">+</button></div></div>';
  if(!edit) h+='<div class="fld"><label for="fx-a">금액 (원)</label><input id="fx-a" class="inp amount num" inputmode="numeric" placeholder="0" value="'+esc(x.amt)+'"></div>';
  else{
    h+='<div class="fld"><span class="lb">금액 일정</span>'+x.sched.map(p=>'<div class="ln"><span>'+keyText(p.from)+'부터</span><span class="l"></span><b>'+(p.amt?money(p.amt):'중단')+'</b>'+(x.sched.length>1?'<button type="button" class="icon" data-fxsd="'+p.from+'" aria-label="삭제">✕</button>':'')+'</div>').join('')+
      '<div class="row-flex" style="margin-top:6px;flex-wrap:wrap"><select id="fx-sf" class="inp" style="flex:1 1 120px">'+keyOpts(viewKey(),rangeFrom(),60)+'</select><input id="fx-a" class="inp num" style="flex:1 1 110px;text-align:right" inputmode="numeric" placeholder="바뀐 금액" value="'+esc(x.amt)+'"><button type="button" class="btn sm fill" data-fxsadd>바꾸기</button></div></div>';
  }
  h+='<div class="fld"><span class="lb">기간</span><div class="row-flex" style="gap:6px;flex-wrap:wrap"><select id="fx-s" class="inp" style="flex:1 1 130px" aria-label="시작">'+keyOpts(x.start,rangeFrom(),72)+'</select><span>~</span><select id="fx-e" class="inp" style="flex:1 1 130px" aria-label="끝"><option value="">계속</option>'+keyOpts(x.end,rangeFrom(),84)+'</select></div>'+
    '<div class="sub" style="margin-top:4px">'+(x.end?'총 '+Math.max(0,ymIdx(x.end)-ymIdx(x.start)+1)+'회'+(ymIdx(x.end)<ymIdx(x.start)?' — 끝이 시작보다 빨라요':''):'끝나는 달 없이 계속 이어져요')+'</div></div>';
  if(x.t==='out'){
    h+='<div class="fld"><label for="fx-fd">예비로 충당</label><select id="fx-fd" class="inp"><option value="">충당 안 함</option>'+FUNDS.map(f=>'<option value="'+esc(f.id)+'"'+(x.fd===f.id?' selected':'')+'>'+esc(f.name)+'</option>').join('')+'</select></div>'+
      (x.fd?'<div class="fld"><label for="fx-fa">충당 금액 (원)</label><input id="fx-fa" class="inp num" inputmode="numeric" value="'+esc(x.fa)+'"></div>':'')+
      '<div class="fld"><label for="fx-sp">송금으로 냄 (정산 보냄 연동)</label><select id="fx-sp" class="inp"><option value="">아니요</option>'+CATS.settle.map(c=>'<option value="'+esc(c.id)+'"'+(x.sp===c.id?' selected':'')+'>'+esc(c.name)+'에게 송금</option>').join('')+'</select></div>'+
      '<label class="opt"><input type="checkbox" id="fx-auto"'+(x.auto?' checked':'')+'> 확정 없이 바로 쓴 금액으로 계산 (송금처럼 따로 잔액에서 빠지는 돈)</label>';
  }
  h+='<div class="foot"><button type="button" class="btn soft" data-close>닫기</button>'+(edit?'<button type="button" class="btn danger" data-fxdel>삭제</button>':'')+'<button type="button" class="btn fill" data-fxsave>저장</button></div>';
  G.sheetRender(h);
}
function fxSetType(k){
  const x=Z.FX;
  if(k==='out'||k==='save'){x.t=k;x.k='in'}else{x.t='settle';x.k=k==='settle-in'?'in':'out'}
  const tk=x.t==='settle'?'settle':x.t;x.cat=CATS[tk][0].id;
  if(x.t!=='out'){x.fd='';x.fa='';x.sp='';x.auto=false}
}
function fxSave(){
  const x=Z.FX,name=($('#fx-n').value||'').trim().slice(0,24);x.name=name;
  if(!name){G.toast('이름을 입력해 주세요');return}
  let cnt=0;
  if(x.end){cnt=ymIdx(x.end)-ymIdx(x.start)+1;if(cnt<1){G.toast('끝나는 달이 시작하는 달보다 빨라요');return}}
  const faNum=x.fd?num(x.fa):0;
  if(!x.id){
    const amt=num($('#fx-a').value);
    if(!amt){G.toast('금액을 입력해 주세요');return}
    const vk=viewKey();
    FIXED.push({id:'fx'+newId(),name:name,t:x.t,cat:x.cat,day:x.day,sched:[{from:x.start,amt:amt}],count:cnt,start:x.start,show:x.start>vk?x.start:vk,fd:x.fd,fa:x.fd?(faNum||amt):0,k:x.t==='settle'?x.k:'',sp:x.t==='out'?x.sp:'',auto:x.t==='out'&&!!x.auto});
  }else{
    const f=FIXED.find(y=>y.id===x.id);if(!f) return;
    const oldStart=fxStart(f);
    f.name=name;f.t=x.t;f.cat=x.cat;f.day=x.day;f.k=x.t==='settle'?x.k:'';f.fd=x.fd;f.fa=x.fd?faNum:0;f.sp=x.t==='out'?x.sp:'';f.auto=x.t==='out'&&!!x.auto;
    f.sched=x.sched.length?x.sched:f.sched;f.count=cnt;
    if(x.start!==oldStart){
      const a=schedAmt(f.sched,x.start),amt=a!=null?a:(f.sched[0]?f.sched[0].amt:0);
      f.sched=[{from:x.start,amt:amt}].concat(f.sched.filter(p=>p.from>x.start));
    }
    f.start=x.start;if(f.show&&f.show<x.start) f.show=x.start;
  }
  G.layerClose();changed();G.toast('저장했어요');
}

/* ───── 사진 분석 (API 키) ───── */
G.subs.photo={title:'사진 분석',html:function(){
  const k=Photo.getKey();
  return '<p class="sub" style="margin:0 2px 8px">사진을 찍으면 날짜, 내용, 금액, 분류를 읽어 줘요. 읽는 일은 Anthropic(Claude)에 맡겨요. 그래서 <b>API 키</b>가 필요하고, 사진은 분석할 때만 Anthropic으로 전송돼요. 이 앱은 사진을 저장하지 않아요.</p>'+
    '<section class="card"><div class="ln"><span>상태</span><span class="l"></span><b>'+(k?'키 저장됨 (…'+esc(k.slice(-4))+')':'키 없음 — 예시 결과만 나와요')+'</b></div>'+
    '<div class="fld"><label for="ph-key">API 키 (sk-ant-…)</label><input id="ph-key" class="inp" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="'+(k?'새 키로 바꾸려면 여기에 붙여넣기':'붙여넣기')+'"></div>'+
    '<div class="fld"><label for="ph-model">모델 (비워 두면 기본값 '+esc(Photo.DEFAULT_MODEL)+')</label><input id="ph-model" class="inp" autocapitalize="off" spellcheck="false" value="'+esc(Photo.getModel())+'"></div>'+
    '<div class="row-flex" style="gap:8px"><button type="button" class="btn fill" data-phkeysave>저장</button>'+(k?'<button type="button" class="btn danger" data-phkeydel>키 지우기</button>':'')+'</div></section>'+
    '<p class="sub" style="margin:10px 2px">키는 <b>이 폰에만</b> 저장돼요(J와 Y가 같이 써요). Anthropic 콘솔(console.anthropic.com)에서 키를 만들고, <b>월 사용 한도</b>를 꼭 정해 두세요. 사진 한 장에 드는 돈은 아주 적어요. 폰을 잃어버리면 콘솔에서 그 키를 지우세요.</p>';
}};

/* ───── 이벤트 ───── */
G.hooks.click.push(function(e,c){
  let b;
  if(UI.tab==='more'&&UI.sub==='photo'){
    if(c('[data-phkeysave]')){
      const k=($('#ph-key').value||'').trim(),m=($('#ph-model').value||'').trim();
      if(k&&!/^sk-ant-/.test(k)){G.toast('키는 sk-ant- 로 시작해요. 다시 확인해 주세요');return true}
      if(k) Photo.setKey(k);
      Photo.setModel(m);G.render(true);G.toast('저장했어요');return true;
    }
    if(c('[data-phkeydel]')){if(confirm('저장된 API 키를 지울까요?')){Photo.setKey('');G.render(true);G.toast('키를 지웠어요')}return true}
  }
  if(UI.tab==='more'&&!UI.ED&&!Z.FD&&!Z.FX&&!Z.EV){
    if(b=c('[data-ctab]')){Z.ct=b.dataset.ctab;G.render(true);return true}
    if(b=c('[data-cadd]')){catAdd(b.dataset.cadd);return true}
    if(b=c('[data-cmove]')){catMove(c('.crow'),Number(b.dataset.cmove));return true}
    if(c('[data-cdel]')){catDel(c('.crow'));return true}
    if(b=c('[data-fund]')){openFund(b.dataset.fund);return true}
    if(c('[data-fadd]')){fundAdd();return true}
    if(c('[data-ipauto]')){IPLAN.base=0;changed();G.toast('자동 계산으로 되돌렸어요');return true}
    if(c('[data-evnew]')){openEv('');return true}
    if(b=c('[data-ev]')){openEv(b.dataset.ev);return true}
    if(c('[data-fxnew]')){openFx('');return true}
    if(b=c('[data-fx]')){openFx(b.dataset.fx);return true}
  }
  if(Z.FD){
    const f=FUNDS.find(x=>x.id===Z.FD);
    if(b=c('[data-fpdel]')){if(f){f.plan=f.plan.filter(p=>p.from!==b.dataset.fpdel);saveCfg();fundSheet();G.render(true)}return true}
    if(c('[data-fpadd]')){
      if(f){setSched(f.plan,$('#fp-from').value,num($('#fp-amt').value));saveCfg();fundSheet();G.render(true);G.toast('계획을 바꿨어요')}
      return true;
    }
    if(b=c('[data-fnew]')){const id=Z.FD;G.layerClose();G.openEditor({type:'fund',c:id,k:b.dataset.fnew});return true}
    if(b=c('[data-fent]')){const id=Z.FD;G.layerClose();G.openEditor({fid:id,tid:b.dataset.fent});return true}
    if(c('[data-fdel]')){fundDelete();return true}
  }
  if(Z.EV){
    if(c('[data-evsave]')){evSave();return true}
    if(c('[data-evdel]')){
      if(confirm('이 일정을 지울까요?')){IPLAN.events=IPLAN.events.filter(x=>x.id!==Z.EV.id);G.layerClose();changed();G.toast('지웠어요')}
      return true;
    }
  }
  if(Z.FX){
    const x=Z.FX;
    if(b=c('[data-fxt]')){fxSetType(b.dataset.fxt);fxSheet();return true}
    if(b=c('[data-fxc]')){x.cat=b.dataset.fxc;fxSheet();return true}
    if(b=c('[data-fxd]')){x.day=Math.max(0,Math.min(31,x.day+Number(b.dataset.fxd)));fxSheet();return true}
    if(b=c('[data-fxsd]')){x.sched=x.sched.filter(p=>p.from!==b.dataset.fxsd);if(!x.sched.length){G.toast('금액 일정이 하나는 있어야 해요');return true}fxSheet();return true}
    if(c('[data-fxsadd]')){const a=num($('#fx-a').value);setSched(x.sched,$('#fx-sf').value,a);x.amt='';fxSheet();return true}
    if(c('[data-fxsave]')){fxSave();return true}
    if(c('[data-fxdel]')){
      if(confirm('"'+x.name+'"을(를) 지울까요? 이미 확정한 내역은 그대로 남아요.')){FIXED=FIXED.filter(f=>f.id!==x.id);G.layerClose();changed();G.toast('지웠어요')}
      return true;
    }
  }
  return false;
});
G.hooks.input.push(function(e){
  const t=e.target;
  if(Z.FX){
    if(t.id==='fx-a'){const v=num(t.value);Z.FX.amt=v?won(v):'';t.value=Z.FX.amt;return true}
    if(t.id==='fx-fa'){const v=num(t.value);Z.FX.fa=v?won(v):'';t.value=Z.FX.fa;return true}
    if(t.id==='fx-n'){Z.FX.name=t.value;return true}
  }
  if(Z.EV){
    if(t.id==='ev-a'){const v=num(t.value);Z.EV.amt=v;t.value=v?won(v):'';return true}
    if(t.id==='ev-n'){Z.EV.name=t.value;return true}
  }
  if(Z.FD&&(t.id==='fp-amt')){const v=num(t.value);t.value=v?won(v):'';return true}
  if(t.id==='ip-base'||t.id==='ip-carry'){const v=num(t.value);t.value=v?won(v):'';return true}
  return false;
});
G.hooks.change.push(function(e){
  const t=e.target;
  if(t.classList&&t.classList.contains('cname-in')){catRename(t);return true}
  if(t.id==='ip-base'){IPLAN.base=num(t.value);changed();G.toast(IPLAN.base?'일반 달 실수령 예상을 정했어요':'자동 계산으로 되돌렸어요');return true}
  if(t.id==='ip-carry'){IPLAN.carry[String(FIRST_YEAR)]=num(t.value);changed();G.toast('시작 이월을 저장했어요');return true}
  if(Z.FD&&t.id==='fd-nm'){
    const f=FUNDS.find(x=>x.id===Z.FD),n=t.value.trim().slice(0,20);
    if(f&&n&&n!==f.name){f.name=n;saveCfg();fundSheet();G.render(true)}
    return true;
  }
  if(Z.EV){
    if(t.id==='ev-y'||t.id==='ev-m') return true;
  }
  if(Z.FX){
    const x=Z.FX;
    if(t.id==='fx-s'){x.start=t.value;fxSheet();return true}
    if(t.id==='fx-e'){x.end=t.value;fxSheet();return true}
    if(t.id==='fx-fd'){x.fd=t.value;if(!t.value) x.fa='';fxSheet();return true}
    if(t.id==='fx-sp'){x.sp=t.value;return true}
    if(t.id==='fx-auto'){x.auto=t.checked;return true}
    if(t.id==='fx-sf') return true;
  }
  return false;
});
})();
