/* 저장소 — 서버 없이 이 기기(브라우저 localStorage)에만 저장해요. J와 Y는 저장 칸이 따로예요.
   (gagyebu2.J.…  /  gagyebu2.Y.…) */
"use strict";
const Store={
  user:null,
  key(k){return 'gagyebu2.'+this.user+'.'+k},
  docKey(y,m){return 'y'+y+'m'+pad(m)},
  lastUser(){try{return localStorage.getItem('gagyebu2.last')}catch(e){return null}},
  resetEngine(){
    CATS=defaultCats();FIXED=[];FUNDS=[{id:'fd-emg',name:'비상금',h:340,plan:[],use:[],tx:[]}];PLANS=[];IPLAN={base:0,events:[],carry:{}};HIDE={};CFG_TS=0;
    Object.keys(YEARS).forEach(k=>delete YEARS[k]);
  },
  /* 브라우저가 저장 공간을 함부로 비우지 않도록 요청해요 (허용 여부는 브라우저가 정해요) */
  persist(){try{if(navigator.storage&&navigator.storage.persist) navigator.storage.persist()}catch(e){}},

  login(user){
    this.user=user;
    try{localStorage.setItem('gagyebu2.last',user)}catch(e){}
    this.resetEngine();this.loadCfg();this.loadYear(S.year);
  },
  logout(){
    this.user=null;
    try{localStorage.removeItem('gagyebu2.last')}catch(e){}
    this.resetEngine();
  },
  loadCfg(){try{const raw=localStorage.getItem(this.key('cfg'));if(raw) applyCfg(JSON.parse(raw))}catch(e){}},
  loadYear(y){
    const ms=ensureYear(y);
    M12.forEach(m=>{try{const raw=localStorage.getItem(this.key(this.docKey(y,m)));if(raw) ms[m]=unpack(JSON.parse(raw))}catch(e){}});
  },
  writeLocal(k,data){
    try{localStorage.setItem(this.key(k),JSON.stringify(data))}
    catch(e){if(window.GApp&&GApp.toast) GApp.toast('저장 공간이 부족해서 저장하지 못했어요. 백업 파일을 받아 두세요')}
  },
  saveMonth(y,m){this.writeLocal(this.docKey(y,m),pack(YEARS[y][m]))},
  saveCfg(){this.writeLocal('cfg',packCfg())},

  /* 이 사용자의 기록을 모두 지워요 */
  wipe(){
    const pre='gagyebu2.'+this.user+'.';
    Object.keys(localStorage).filter(k=>k.indexOf(pre)===0).forEach(k=>localStorage.removeItem(k));
    this.resetEngine();ensureYear(S.year);
  },

  /* 백업 파일 만들기 / 가져오기 (기존 가계부 백업 파일도 읽을 수 있어요) */
  exportJSON(){
    const years={};
    Object.keys(YEARS).forEach(y=>{years[y]={};M12.forEach(m=>{years[y][m]=pack(YEARS[y][m])})});
    return JSON.stringify({app:'gagyebu',version:5,user:this.user,cfg:packCfg(),years:years},null,1);
  },
  importJSON(text){
    const o=JSON.parse(text);
    if(!o||o.app!=='gagyebu') throw new Error('가계부 백업 파일이 아니에요');
    if(o.cfg&&applyCfg(o.cfg)) saveCfg();
    const put=(y,months)=>{
      ensureYear(y);
      M12.forEach(m=>{const md=unpack(months[m]||months[String(m)]);md.ts=Date.now();YEARS[y][m]=md;saveMonth(y,m)});
    };
    if(o.years) Object.keys(o.years).forEach(y=>put(Number(y),o.years[y]));
    else if(o.months) put(Number(o.year)||S.year,o.months);
  }
};
Hooks.month=function(y,m){Store.saveMonth(y,m)};
Hooks.cfg=function(){Store.saveCfg()};
