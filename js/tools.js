/* 입력 도우미 — 전체 검색, 붙여넣어 입력 */
(function(){
"use strict";
const G=GApp,UI=G.UI,$=G.$,TL=G.TL;
G.hooks.close.push(function(){UI.SR=null;UI.PP=null});

/* ───── 전체 검색 ───── */
const SQ={type:'all'};
G.openSearch=function(){
  SQ.type='all';UI.SR=true;
  G.layerOpen('<h2>전체 검색</h2><input id="s-q" class="inp" placeholder="내용, 메모, 분류, 금액으로 찾기" autocomplete="off" aria-label="검색어"><div id="s-chips" class="chips" style="margin:10px 0 4px"></div><p id="s-sum" class="sub" style="margin:2px 0 6px"></p><div id="s-res"></div><div class="foot"><button type="button" class="btn soft" data-close>닫기</button></div>');
  runSearch();
  setTimeout(()=>{const el=$('#s-q');if(el) el.focus()},60);
};
function runSearch(){
  const chips=[['all','전체'],['out','지출'],['in','수입'],['ded','공제'],['save','저축'],['settle','정산'],['fund','예비']];
  $('#s-chips').innerHTML=chips.map(x=>'<button type="button" class="chip'+(SQ.type===x[0]?' on':'')+'" data-sq="'+x[0]+'">'+x[1]+'</button>').join('');
  const q=($('#s-q').value||'').trim().toLowerCase(),box=$('#s-res'),sum=$('#s-sum');
  if(!q){box.innerHTML='<p class="empty" style="font-size:20px">찾을 말을 적어 보세요.<br>모든 달을 한꺼번에 찾아요.</p>';sum.textContent='';return}
  const toks=q.split(/\s+/),hit=h=>toks.every(k=>h.indexOf(k)>=0),res=[];
  for(let y=FIRST_YEAR;y<=NOW.getFullYear()+1;y++){
    const ms=G.loadY(y);
    M12.forEach(m=>{
      if(SQ.type!=='fund') ms[m].tx.forEach(t=>{
        if(SQ.type!=='all'&&t.t!==SQ.type) return;
        const hay=[t.n,t.m,catName(t.t,effId(t)),TL[t.t],String(t.a),won(t.a)].join(' ').toLowerCase();
        if(hit(hay)) res.push({y:y,m:m,d:t.d||0,label:t.t==='settle'?'정산':TL[t.t],c:catName(t.t,effId(t)),n:t.n||'',a:t.a,sign:t.t==='in'?1:(t.t==='out'||t.t==='ded')?-1:(t.t==='settle'?(t.k==='out'?-1:1):0),id:t.id});
      });
      if(SQ.type==='all'||SQ.type==='fund') FUNDS.forEach(f=>f.tx.forEach(t=>{
        if(t.y!==y||t.m!==m) return;
        const hay=[t.n,t.r,f.name,'예비',String(t.a),won(t.a)].join(' ').toLowerCase();
        if(hit(hay)) res.push({y:y,m:m,d:t.d||0,label:'예비',c:f.name,n:t.n||'',a:t.a,sign:t.k==='in'?1:-1,id:t.id,fid:f.id});
      }));
    });
  }
  res.sort((a,b)=>(a.y-b.y)||(a.m-b.m)||((a.d||99)-(b.d||99)));
  const by={};res.forEach(r=>{(by[r.label]=by[r.label]||{n:0,a:0});by[r.label].n++;by[r.label].a+=r.a});
  sum.textContent=res.length?Object.keys(by).map(k=>k+' '+by[k].n+'건 '+won(by[k].a)+'원').join(' · '):'';
  const shown=res.slice(0,200);
  box.innerHTML=shown.length?shown.map(r=>'<div class="it" role="button" tabindex="0" data-sr="'+r.y+'|'+r.m+'|'+esc(r.id)+'|'+esc(r.fid||'')+'"><span class="sub" style="flex:none;width:62px">'+String(r.y).slice(2)+'.'+r.m+'.'+(r.d||'-')+'</span><div class="mid"><b>'+esc(r.n||r.c)+'</b><small><em class="tag'+(r.label==='예비'?' fund':(r.label==='정산'?' settle':''))+'">'+r.label+'</em>'+esc(r.c)+'</small></div><div class="amt num">'+(r.sign>0?'+':r.sign<0?MINUS:'')+won(r.a)+'</div></div>').join('')+(res.length>200?'<p class="sub">200건까지만 보여요. 검색어를 더 구체적으로 적어 보세요.</p>':''):'<p class="empty" style="font-size:20px">찾은 내역이 없어요.</p>';
}
function goResult(el){
  const p=el.dataset.sr.split('|'),y=Number(p[0]),m=Number(p[1]),id=p[2],fid=p[3];
  G.layerClose();G.goto(y,m);
  if(fid) G.openEditor({fid:fid,tid:id});else G.openEditor({id:id});
}

/* ───── 붙여넣어 입력 ───── */
G.openPaste=function(text){
  const ty=UI.lastPasteType||'out';
  UI.PP={stage:'input',type:ty,cat:OTHER[ty],text:typeof text==='string'?text:'',rows:[]};
  G.layerOpen(pasteHTML());
};
const catOpts=(ty,sel)=>CATS[ty].map(c=>'<option value="'+esc(c.id)+'"'+(c.id===sel?' selected':'')+'>'+esc(c.name)+'</option>').join('');
function pasteHTML(){
  const p=UI.PP;
  if(p.stage==='input') return '<h2>붙여넣어 입력</h2><p class="sub">카드 앱이나 엑셀에서 복사한 내역을 붙여넣으세요. 한 줄에 한 건이고, 날짜(17, 3/17, 2027-03-17), 내용, 금액을 알아서 나눠요. 내용에 분류 이름이 있으면 그 분류로 넣어요.</p>'+
    '<div class="row-flex" style="margin:8px 0"><select id="pp-type" class="inp" style="flex:1" aria-label="종류">'+['out','in','ded','save'].map(t=>'<option value="'+t+'"'+(p.type===t?' selected':'')+'>'+TL[t]+'</option>').join('')+'</select><select id="pp-cat" class="inp" style="flex:1" aria-label="기본 분류">'+catOpts(p.type,p.cat)+'</select></div>'+
    '<textarea id="pp-text" class="inp" style="min-height:140px" placeholder="예)&#10;3/17 점심 12,000&#10;18 주유 52,300&#10;2027-03-20 스타벅스 5,500" aria-label="붙여넣을 내역">'+esc(p.text)+'</textarea>'+
    '<div class="foot"><button type="button" class="btn soft" data-close>닫기</button><button type="button" class="btn fill" data-ppparse>미리보기</button></div>';
  const n=p.rows.filter(r=>r.on&&!r.err).length;
  let h='<h2>이렇게 읽었어요</h2><p class="sub">틀린 곳은 고친 뒤에 등록하세요. 줄마다 분류를 바꿀 수 있어요.</p>';
  p.rows.forEach((r,i)=>{
    h+='<div class="pp" data-pi="'+i+'"'+(r.err?' style="opacity:.55"':'')+'><input type="checkbox" class="pp2-on"'+(r.on?' checked':'')+(r.err?' disabled':'')+' aria-label="등록"><div class="row-flex"><input class="inp pp2-d" style="width:62px;min-height:40px;padding:4px 8px" inputmode="numeric" value="'+(r.mo?r.mo+'/':'')+(r.d||'')+'" aria-label="날짜"'+(r.err?' disabled':'')+'><input class="inp pp2-n" style="min-height:40px;padding:4px 8px" value="'+esc(r.n)+'" aria-label="내용"'+(r.err?' disabled':'')+'></div>'+
      '<input class="inp pp2-a num" style="width:108px;min-height:40px;padding:4px 8px;text-align:right" inputmode="numeric" value="'+(r.err?'':won(r.a))+'" aria-label="금액"'+(r.err?' disabled':'')+'>'+
      (r.err?'<span class="sub" style="color:var(--over);flex:0 0 100%">'+esc(r.err)+'</span>':'<select class="pp2-c" aria-label="분류">'+catOpts(p.type,r.c)+'</select>')+'</div>';
  });
  return h+'<div class="foot"><button type="button" class="btn soft" data-ppback>다시 쓰기</button><button type="button" class="btn fill" data-ppsave'+(n?'':' disabled')+'>'+n+'건 등록</button></div>';
}
function ppLine(line,type,def){
  let s0=String(line).replace(/\u00a0/g,' ').trim();
  if(!s0) return null;
  const am=[...s0.matchAll(/(\d{1,3}(?:,\d{3})+|\d{3,})\s*원?/g)];
  if(!am.length) return {err:'금액을 찾지 못했어요',n:s0,a:0,c:def,on:false};
  const last=am[am.length-1],a=Number(last[1].replace(/,/g,''));
  s0=s0.slice(0,last.index)+' '+s0.slice(last.index+last[0].length);
  let mo=0,d=0;
  const dm=s0.match(/(?:^|\s)(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})(?=\s|$)/);
  if(dm&&Number(dm[2])>=1&&Number(dm[2])<=12&&Number(dm[3])>=1&&Number(dm[3])<=31){mo=Number(dm[2]);d=Number(dm[3]);s0=s0.replace(dm[0],' ')}
  else{const dd=s0.match(/^\s*(\d{1,2})\s*일?(?=\s)/);if(dd&&Number(dd[1])>=1&&Number(dd[1])<=31){d=Number(dd[1]);s0=s0.replace(dd[0],' ')}}
  let c=def;
  const names=CATS[type].filter(x=>x.id!==OTHER[type]).slice().sort((p,q)=>q.name.length-p.name.length);
  for(const k of names){if(s0.indexOf(k.name)>=0){c=k.id;s0=s0.replace(k.name,' ');break}}
  const n=s0.replace(/[\t|]+/g,' ').replace(/\s{2,}/g,' ').replace(/^[\s,:\-]+|[\s,:\-]+$/g,'').trim();
  return {mo:mo,d:d,n:n,a:a,c:c,on:true};
}
function ppParse(){
  const p=UI.PP;p.text=($('#pp-text').value||'');
  p.rows=p.text.split(/\r?\n/).map(l=>ppLine(l,p.type,p.cat)).filter(Boolean);
  if(!p.rows.length){G.toast('붙여넣은 내용이 없어요');return}
  UI.lastPasteType=p.type;p.stage='preview';G.sheetRender(pasteHTML());
}
function ppSave(){
  const p=UI.PP,ok=p.rows.filter(r=>r.on&&!r.err&&r.a);if(!ok.length) return;
  const s0=G.snap(M12.slice()),touched={},base=S.view;
  ok.forEach(r=>{const mo=r.mo||base;ensureYear(S.year)[mo].tx.push({id:newId(),d:Math.min(r.d||0,daysIn(S.year,mo)),t:p.type,c:r.c,n:r.n,a:r.a,m:''});touched[mo]=1});
  Object.keys(touched).forEach(m=>saveMonth(S.year,Number(m)));
  G.layerClose();G.render(true);
  G.toast(ok.length+'건을 등록했어요'+(Object.keys(touched).length>1?' ('+Object.keys(touched).join('·')+'월에 나눠 들어갔어요)':''),()=>G.restore(s0));
}

/* ───── 이벤트 ───── */
G.hooks.click.push(function(e,c){
  let b;
  if(UI.SR){
    if(b=c('[data-sq]')){SQ.type=b.dataset.sq;runSearch();return true}
    if(b=c('[data-sr]')){goResult(b);return true}
  }
  if(UI.PP){
    if(c('[data-ppparse]')){ppParse();return true}
    if(c('[data-ppback]')){UI.PP.stage='input';G.sheetRender(pasteHTML());return true}
    if(c('[data-ppsave]')){ppSave();return true}
  }
  return false;
});
G.hooks.input.push(function(e){
  const t=e.target;
  if(t.id==='s-q'&&UI.SR){runSearch();return true}
  if(UI.PP){
    if(t.id==='pp-text'){UI.PP.text=t.value;return true}
    const row=t.closest&&t.closest('.pp');
    if(row){
      const r=UI.PP.rows[Number(row.dataset.pi)];if(!r) return true;
      if(t.classList.contains('pp2-n')) r.n=t.value;
      else if(t.classList.contains('pp2-a')){const v=num(t.value);r.a=v;t.value=v?won(v):''}
      else if(t.classList.contains('pp2-d')){const m=/^(?:(\d{1,2})\/)?(\d{0,2})$/.exec(t.value.trim());if(m){r.mo=m[1]?Math.min(12,Number(m[1])):0;r.d=Math.min(31,Number(m[2])||0)}}
      return true;
    }
  }
  return false;
});
G.hooks.change.push(function(e){
  const t=e.target;
  if(!UI.PP) return false;
  if(t.id==='pp-type'){UI.PP.type=t.value;UI.PP.cat=OTHER[t.value];UI.PP.text=($('#pp-text')?$('#pp-text').value:UI.PP.text);G.sheetRender(pasteHTML());return true}
  if(t.id==='pp-cat'){UI.PP.cat=t.value;return true}
  const row=t.closest&&t.closest('.pp');
  if(row){
    const r=UI.PP.rows[Number(row.dataset.pi)];if(!r) return true;
    if(t.classList.contains('pp2-on')){r.on=t.checked;G.sheetRender(pasteHTML())}
    else if(t.classList.contains('pp2-c')) r.c=t.value;
    return true;
  }
  return false;
});
})();
