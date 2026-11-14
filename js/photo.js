/* 사진으로 입력 — 폰 카메라로 찍은 영수증·카드 내역을 읽어서 수입/지출 내역으로 바꿔 줘요.
   서버 없이, 폰에 저장한 API 키로 Anthropic(Claude)에 사진을 보내 분석해요. 키가 없으면 예시 결과만 보여 줘요. */
"use strict";
const Photo={
  DEFAULT_MODEL:'claude-sonnet-5-5',
  getKey(){try{return localStorage.getItem('gagyebu2.aikey')||''}catch(e){return ''}},
  setKey(k){try{if(k) localStorage.setItem('gagyebu2.aikey',k);else localStorage.removeItem('gagyebu2.aikey')}catch(e){}},
  getModel(){try{return localStorage.getItem('gagyebu2.aimodel')||''}catch(e){return ''}},
  setModel(m){try{if(m) localStorage.setItem('gagyebu2.aimodel',m);else localStorage.removeItem('gagyebu2.aimodel')}catch(e){}},

  /* 사진을 줄여서(가로세로 최대 1280px) 보내요: 속도와 비용을 아끼기 위해서예요 */
  resize(file,max){
    max=max||1280;
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onerror=()=>reject(new Error('사진을 읽지 못했어요'));
      r.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject(new Error('사진 형식을 읽지 못했어요'));
        img.onload=()=>{
          const k=Math.min(1,max/Math.max(img.width,img.height));
          const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
          c.getContext('2d').drawImage(img,0,0,c.width,c.height);
          const dataUrl=c.toDataURL('image/jpeg',0.82);
          resolve({dataUrl:dataUrl,base64:dataUrl.split(',')[1],mime:'image/jpeg'});
        };
        img.src=r.result;
      };
      r.readAsDataURL(file);
    });
  },
  catNames(){const o={};['out','in'].forEach(t=>{o[t]=CATS[t].map(c=>c.name)});return o},

  buildPrompt(today,cats){
    const out=cats.out||[],inc=cats.in||[];
    return [
      '당신은 한국어 가계부 입력을 돕는 도우미예요. 사진은 영수증, 카드 결제 내역 화면, 은행 거래 내역, 급여명세서 중 하나예요.',
      '사진에 보이는 거래를 읽어서 JSON만 출력하세요. 설명이나 마크다운 코드 블록은 쓰지 마세요.',
      '오늘 날짜: '+today,
      '',
      '형식: {"items":[{"date":"YYYY-MM-DD 또는 null","n":"가게 또는 내용(짧게)","a":금액(정수),"type":"out 또는 in","c":"분류 이름 또는 null"}]}',
      '',
      '규칙:',
      '- 영수증 한 장이면 합계 금액 하나만 한 건으로 만들고, 내용(n)에는 가게 이름을 쓰세요. 품목별로 나누지 마세요.',
      '- 카드 내역이나 거래 내역 화면이면 보이는 거래마다 한 건씩 만드세요.',
      '- 돈을 쓴 것은 type "out", 돈이 들어온 것(급여, 입금, 환불·취소)은 "in"이에요.',
      '- 금액(a)은 원 단위 정수예요. 쉼표나 "원" 글자 없이 숫자만 쓰세요.',
      '- 날짜가 없거나 읽을 수 없으면 null이에요. 연도가 없으면 오늘 날짜의 연도를 쓰세요.',
      '- 분류(c)는 아래 목록에서 가장 알맞은 하나를 글자 그대로 고르세요. 알맞은 것이 없으면 null이에요.',
      '  지출 분류: '+(out.join(', ')||'(없음)'),
      '  수입 분류: '+(inc.join(', ')||'(없음)'),
      '- 거래를 읽을 수 없거나 거래 사진이 아니면 {"items":[]} 만 출력하세요.'
    ].join('\n');
  },
  normDate(v,today){
    if(v==null) return null;
    const s=String(v).trim();let y,m,d,mm;
    if((mm=/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(s))){y=+mm[1];m=+mm[2];d=+mm[3]}
    else if((mm=/^(\d{1,2})[-./](\d{1,2})$/.exec(s))){y=+String(today).slice(0,4);m=+mm[1];d=+mm[2]}
    else return null;
    const dt=new Date(Date.UTC(y,m-1,d));
    if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d) return null;
    return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  },
  parseItems(text,today,cats){
    const s=String(text||'').replace(/```(?:json)?/gi,''),i=s.indexOf('{'),j=s.lastIndexOf('}');
    if(i<0||j<=i) return [];
    let obj;try{obj=JSON.parse(s.slice(i,j+1))}catch(e){return []}
    const arr=Array.isArray(obj)?obj:(Array.isArray(obj.items)?obj.items:[]),items=[];
    arr.slice(0,60).forEach(x=>{
      if(!x||typeof x!=='object') return;
      const a=Math.round(Number(String(x.a==null?'':x.a).replace(/[^\d.]/g,'')));
      if(!(a>0)) return;
      const type=x.type==='in'?'in':'out',list=Array.isArray(cats[type])?cats[type]:[];
      items.push({date:this.normDate(x.date,today),n:String(x.n==null?'':x.n).trim().slice(0,40),a:a,type:type,c:(typeof x.c==='string'&&list.indexOf(x.c)>=0)?x.c:null});
    });
    return items;
  },

  /* 키가 있으면 AI로(정확), 없거나 AI가 안 되면 폰 안에서 글자를 읽어요(키 없이) */
  async analyze(file,today,progress){
    let note='';
    if(this.getKey()){
      try{const r=await this.analyzeAI(file,today);return r}
      catch(e){
        if(/키가 올바르지|사용할 수 없어요|모델 이름/.test(e.message)) throw e;   // 키·모델 문제는 그대로 알려 줘요
        note='AI 분석을 쓸 수 없어서(' +e.message+ ') 폰 안에서 글자를 읽었어요.';
      }
    }
    return this.analyzeOcr(file,today,progress,note);
  },
  async analyzeOcr(file,today,progress,note){
    let r;
    Ocr.onLog=m=>{
      if(!progress) return;
      if(m.status==='recognizing text') progress('사진 읽는 중 '+Math.round((m.progress||0)*100)+'%');
      else if(/loading|initializ/.test(m.status||'')) progress('글자 인식 준비 중이에요 (처음 한 번은 오래 걸려요)');
    };
    try{r=await Ocr.read(file)}
    catch(e){
      if(window.__PREVIEW__){const img=await this.resize(file);return {mode:'mock',thumb:img.dataUrl,items:this.mockItems(today),text:'',note:''}}
      throw new Error(e&&e.message?e.message:'사진을 읽지 못했어요');
    }
    return {mode:'ocr',thumb:r.thumb,text:r.text,items:Ocr.parse(r.text,today,this.catNames()),note:note||''};
  },
  async analyzeAI(file,today){
    const img=await this.resize(file),key=this.getKey(),cats=this.catNames();
    let res;
    try{
      res=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json','anthropic-dangerous-direct-browser-access':'true'},
        body:JSON.stringify({model:this.getModel()||this.DEFAULT_MODEL,max_tokens:1500,messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:img.mime,data:img.base64}},
          {type:'text',text:this.buildPrompt(today,cats)}]}]})
      });
    }catch(e){throw new Error('인터넷에 연결되지 않았어요')}
    if(!res.ok){
      const why={401:'API 키가 올바르지 않아요',403:'이 API 키로는 사용할 수 없어요',404:'모델 이름을 찾을 수 없어요(더보기 → 사진 분석에서 확인)',429:'사용 한도에 걸렸어요',413:'사진이 너무 커요'}[res.status];
      throw new Error(why||'AI 분석에 실패했어요 ('+res.status+')');
    }
    let data;try{data=await res.json()}catch(e){throw new Error('분석 결과를 읽지 못했어요')}
    const text=(Array.isArray(data.content)?data.content:[]).filter(b=>b&&b.type==='text').map(b=>b.text).join('\n');
    return {mode:'ai',thumb:img.dataUrl,text:'',items:this.parseItems(text,today,cats),note:''};
  },
  /* 키가 없을 때 화면을 확인하기 위한 예시: 실제로 사진을 읽지 않아요 */
  mockItems(today){
    const o=CATS.out,pick=n=>(o.find(c=>c.name===n)||o[0]).name;
    return [
      {date:today,n:'편의점',a:4300,type:'out',c:pick('식비-음료')},
      {date:today,n:'주유소',a:52300,type:'out',c:pick('주유')},
      {date:today,n:'점심 식사',a:12000,type:'out',c:pick('식비-외식')}
    ];
  }
};
