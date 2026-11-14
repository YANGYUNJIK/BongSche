/* 폰 안에서 사진 속 글자를 읽고(Tesseract), 읽은 글자에서 날짜·가게·금액·수입/지출을 뽑아요.
   서버도 API 키도 필요 없어요. 파일은 vendor/tesseract/ 에 들어 있어요. */
"use strict";
const Ocr={
  /* ───── 글자 읽기 ───── */
  _lib:null,_worker:null,_idle:null,onLog:null,
  loadLib(){
    if(this._lib) return this._lib;
    this._lib=new Promise((res,rej)=>{
      const s=document.createElement('script');s.src='vendor/tesseract/tesseract.min.js';
      s.onload=()=>res(window.Tesseract);
      s.onerror=()=>{this._lib=null;rej(new Error('글자 인식 파일을 불러오지 못했어요'))};
      document.head.appendChild(s);
    });
    return this._lib;
  },
  async getWorker(){
    if(this._worker) return this._worker;
    const T=await this.loadLib(),abs=p=>new URL(p,location.href).href;
    this._worker=await T.createWorker('kor+eng',1,{
      workerPath:abs('vendor/tesseract/worker.min.js'),
      corePath:abs('vendor/tesseract/core/'),
      langPath:abs('vendor/tesseract/lang'),
      logger:m=>{if(Ocr.onLog) Ocr.onLog(m)}
    });
    return this._worker;
  },
  /* 사진을 읽기 좋게: 크기를 줄이고(최대 1800px), 흑백으로 바꾸고, 밝기 차이를 넓혀요 */
  prep(file){
    return new Promise((resolve,reject)=>{
      const fr=new FileReader();
      fr.onerror=()=>reject(new Error('사진을 읽지 못했어요'));
      fr.onload=()=>{
        const img=new Image();
        img.onerror=()=>reject(new Error('사진 형식을 읽지 못했어요'));
        img.onload=()=>{
          const k=Math.min(1,1800/Math.max(img.width,img.height));
          const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
          const g=c.getContext('2d');g.drawImage(img,0,0,c.width,c.height);
          const im=g.getImageData(0,0,c.width,c.height),d=im.data,hist=new Array(256).fill(0);
          for(let i=0;i<d.length;i+=4){const v=Math.round(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114);d[i]=d[i+1]=d[i+2]=v;hist[v]++}
          const n=c.width*c.height;let lo=0,hi=255,acc=0;
          for(let v=0;v<256;v++){acc+=hist[v];if(acc>=n*0.02){lo=v;break}}
          acc=0;for(let v=255;v>=0;v--){acc+=hist[v];if(acc>=n*0.02){hi=v;break}}
          if(hi-lo>30){const sc=255/(hi-lo);for(let i=0;i<d.length;i+=4){const v=Math.max(0,Math.min(255,Math.round((d[i]-lo)*sc)));d[i]=d[i+1]=d[i+2]=v}}
          g.putImageData(im,0,0);
          // 화면에 보여 줄 작은 사진
          const t=document.createElement('canvas'),tk=Math.min(1,480/Math.max(c.width,c.height));t.width=Math.round(c.width*tk);t.height=Math.round(c.height*tk);
          t.getContext('2d').drawImage(c,0,0,t.width,t.height);
          resolve({canvas:c,thumb:t.toDataURL('image/jpeg',0.6)});
        };
        img.src=fr.result;
      };
      fr.readAsDataURL(file);
    });
  },
  async read(file){
    const p=await this.prep(file),w=await this.getWorker();
    const r=await w.recognize(p.canvas);
    clearTimeout(this._idle);
    this._idle=setTimeout(()=>{if(Ocr._worker){Ocr._worker.terminate();Ocr._worker=null}},90000);   // 안 쓰면 메모리 반납
    return {text:r.data.text||'',thumb:p.thumb};
  },

  /* ───── 읽은 글자 → 내역 ───── */
  KEY_T1:/실\s*수령|차인\s*지급|결제\s*금?\s*액|승인\s*금\s*액|받을\s*금\s*액|청구\s*금\s*액|결제금|입금\s*액|출금\s*액|카드\s*승인|승인\s*금|지급\s*액/,
  KEY_T2:/합\s*계|총\s*(?:액|금액|합계)/,
  KEY_TOTAL:/합\s*계|총\s*(?:액|금액|합계)|결제\s*금?\s*액|승인\s*금\s*액|받을\s*금\s*액|청구\s*금\s*액|결제금|입금\s*액|출금\s*액|실\s*수령|차인\s*지급|지급\s*액|카드\s*승인|승인\s*금/,
  KEY_SKIP:/부가\s*세|과세|면세|거스름|받은\s*금|받은돈|잔액|포인트|할인|공급\s*가|봉사료|공제|소득세|건강보험|국민연금/,
  KEY_NOMERCH:/영수증|매출|전표|신용|체크|카드|승인|사업자|대표|전화|주소|일시|결제|합계|입금|알림|출금|금액|번호|Web발신|발신|감사|고객|교환|환불|부가|과세|면세|할부|일시불|TEL|tel|단말기|가맹/,
  CARDS:/신한|삼성|국민|KB|현대|롯데|하나|우리|농협|NH|BC|비씨|카카오뱅크|토스|씨티/,
  CAT_RULES:[
    [/주유|GS\s*칼텍스|칼텍스|SK\s*에너지|에너지|S-?OIL|오일뱅크|알뜰|충전소/i,['주유']],
    [/하이패스|톨게이트|도로공사|통행/,['톨비']],
    [/편의점|GS\s*25|\bCU\b|세븐|7-?ELEVEN|이마트\s*24|미니스톱|카페|커피|스타벅스|이디야|투썸|메가\s*커피|컴포즈|빽다방|음료|주스|베이커리|빵|제과|맘스터치/i,['식비-음료']],
    [/식당|음식|치킨|피자|갈비|국밥|김밥|분식|한식|중식|일식|레스토랑|고기|횟집|족발|보쌈|찌개|면옥|냉면|배달|요기요|배민|쿠팡이츠|맥도날드|버거|롯데리아|서브웨이|파스타|초밥|마라/,['식비-외식']],
    [/미용|헤어|네일|이발/,['미용']],
    [/통신|KT|SKT|LG\s*U\+|U\+|알뜰폰/i,['통신비']],
    [/보험/,['보험']],
    [/영화|CGV|메가박스|롯데시네마|노래|게임|오락/,['오락']],
    [/관리비|아파트/,['관리비']],
    [/다이소|마트|문구|생활용품|쿠팡|올리브영|약국|잡화/,['잡화']]
  ],
  PAT_BIZ:/\d{3}-\d{2}-\d{5}/g,
  PAT_TEL:/\(?0\d{1,2}\)?[-\s]?\d{3,4}[-\s]\d{4}/g,
  PAT_TIME:/\b\d{1,2}:\d{2}(?::\d{2})?\b/g,
  validYMD(y,m,d){const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d},
  /* 줄에서 날짜 찾기 → {date:'YYYY-MM-DD', text:날짜를 뺀 글자} 또는 null */
  findDate(s,today){
    const ty=Number(String(today).slice(0,4));let m,y,mo,d;
    const rules=[
      [/(20\d\d)\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?/,x=>[+x[1],+x[2],+x[3]]],
      [/(?<!\d)(\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})(?!\d)/,x=>[2000+ +x[1],+x[2],+x[3]]],
      [/(\d{1,2})\s*월\s*(\d{1,2})\s*일/,x=>[ty,+x[1],+x[2]]],
      [/(?<![\d,.])(\d{1,2})\s*[/.]\s*(\d{1,2})(?![\d,.:])/,x=>[ty,+x[1],+x[2]]]
    ];
    for(const [re,f] of rules){
      m=re.exec(s);if(!m) continue;
      [y,mo,d]=f(m);
      if(mo>=1&&mo<=12&&d>=1&&d<=31&&this.validYMD(y,mo,d)) return {date:y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'),text:s.replace(m[0],' ')};
    }
    return null;
  },
  /* 줄에서 금액 후보 찾기 (사업자번호·전화번호·시각·날짜는 먼저 빼요) */
  amountsIn(s){
    const t=s.replace(this.PAT_BIZ,' ').replace(this.PAT_TEL,' ').replace(this.PAT_TIME,' ')
      .replace(/20\d\d\s*[-./]\s*\d{1,2}\s*[-./]\s*\d{1,2}/g,' ').replace(/\d{2}\s*[-./]\s*\d{1,2}\s*[-./]\s*\d{1,2}/g,' ');
    const out=[];const re=/\d[\d,]*\d|\d/g;let m;
    while((m=re.exec(t))){
      const v=Number(m[0].replace(/,/g,''));
      if(m[0].length>=3&&v>=100&&v<=99999999) out.push(v);
    }
    return out;
  },
  guessCat(text,type,names){
    const list=names||[];
    if(type==='in') return /급여|월급|실수령|차인/.test(text)?(list.indexOf('본봉')>=0?'본봉':null):(list.indexOf('추가 수입')>=0?'추가 수입':null);
    for(const [re,cands] of this.CAT_RULES){
      if(re.test(text)){const c=cands.find(x=>list.indexOf(x)>=0);if(c) return c}
    }
    return null;
  },
  guessType(text){
    if(/급여\s*명세|월급|급여|실수령|차인\s*지급|입금|환불\s*완료|급여일/.test(text)&&!/출금|승인|결제/.test(text)) return 'in';
    if(/보너스|상여|수당/.test(text)&&!/승인|결제/.test(text)) return 'in';
    return 'out';
  },
  cleanMerchant(s){
    return s.replace(this.PAT_BIZ,' ').replace(this.PAT_TEL,' ').replace(this.PAT_TIME,' ')
      .replace(/\d[\d,]*\d?\s*원?/g,' ').replace(/[\[\]()<>|:·*#=_~]+/g,' ').replace(/\s{2,}/g,' ').trim();
  },
  cleanName(s){
    return this.cleanMerchant(s).replace(new RegExp(this.KEY_NOMERCH.source,'g'),' ').replace(/주식회사|\(주\)|㈜|유한회사/g,' ')
      .replace(/[ㄱ-ㅎㅏ-ㅣ]+/g,' ').replace(/\s{2,}/g,' ').trim();
  },
  /* 줄마다 점수를 매겨 가게 이름으로 가장 그럴듯한 것을 골라요 (시각이 같이 있는 줄, 위쪽 줄, 카드사 이름이 아닌 줄) */
  pickMerchant(lines,today){
    let best='',bs=0;
    lines.forEach((l,i)=>{
      let s=l;const f=this.findDate(s,today);if(f) s=f.text;
      const c=this.cleanName(s),letters=(c.match(/[가-힣A-Za-z]/g)||[]).length;
      if(letters<2) return;
      let sc=letters+(/\d{1,2}:\d{2}/.test(l)?3:0)-i*0.3;
      if(this.CARDS.test(c)) sc-=6;
      if(sc>bs){bs=sc;best=c}
    });
    return best;
  },
  /* 한 장짜리 영수증/문자 캡처로 보고 한 건 만들기 */
  parseSingle(lines,today,cats){
    const text=lines.join('\n');
    // 금액: 합계 같은 낱말이 있는 줄 우선, 없으면 가장 큰 금액
    let best=0;
    const pickMax=re=>{let b=0;lines.forEach(l=>{if(re.test(l)&&!this.KEY_SKIP.test(l)){this.amountsIn(l).forEach(v=>{if(v>b) b=v})}});return b};
    best=pickMax(this.KEY_T1)||pickMax(this.KEY_T2);
    if(!best){lines.forEach(l=>{if(this.KEY_SKIP.test(l)) return;this.amountsIn(l).forEach(v=>{if(v>best) best=v})})}
    if(!best) return [];
    // 날짜
    let date=null;
    for(const l of lines){const f=this.findDate(l,today);if(f){date=f.date;break}}
    // 가게 이름
    let n='';
    for(const l of lines){const mm=/(?:상호|가맹점명?|매장명?|점포명?)\s*[:：]?\s*(.+)/.exec(l);if(mm){const c=this.cleanName(mm[1]);if(c.length>=2){n=c;break}}}
    if(!n) n=this.pickMerchant(lines,today);
    const type=this.guessType(text),names=type==='in'?cats.in:cats.out;
    if(type==='in'&&/급여|월급|실수령/.test(text)) n='급여';
    return [{date:date,n:n.slice(0,20),a:best,type:type,c:this.guessCat(text,type,names)}];
  },
  /* 거래가 줄마다 있는 목록(카드 앱·통장 내역 캡처)이면 줄마다 한 건 */
  parseList(lines,today,cats){
    const items=[];let lastDate=null;
    lines.forEach(l=>{
      const f=this.findDate(l,today);
      if(f&&!this.amountsIn(l).length){lastDate=f.date;return}
      if(this.KEY_TOTAL.test(l)&&!/\d{1,2}\s*[/.]\s*\d{1,2}/.test(l)) return;
      const amts=this.amountsIn(f?f.text:l);
      if(!amts.length) return;
      const date=f?f.date:lastDate;if(f) lastDate=f.date;
      if(!f&&!date) return;
      const a=amts[amts.length-1];
      const n=this.cleanName(f?f.text:l);
      const type=/입금|환불|급여/.test(l)&&!/출금|승인/.test(l)?'in':'out',names=type==='in'?cats.in:cats.out;
      items.push({date:date,n:n.slice(0,20),a:a,type:type,c:this.guessCat(l,type,names)});
    });
    return items;
  },
  parse(text,today,cats){
    cats=cats||{out:[],in:[]};
    const lines=String(text||'').split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(s=>s.length>0);
    if(!lines.length) return [];
    const dated=lines.filter(l=>this.findDate(l,today)&&this.amountsIn(this.findDate(l,today).text).length&&!this.KEY_TOTAL.test(l));
    if(dated.length>=2){const li=this.parseList(lines,today,cats);if(li.length>=2) return li}
    return this.parseSingle(lines,today,cats);
  }
};
