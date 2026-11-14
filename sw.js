/* 오프라인 캐시 — 앱 파일을 폰에 저장해 두고, 인터넷이 없어도 화면이 열리게 해요.
   파일을 고쳐서 다시 올렸다면 아래 VERSION 숫자를 올려 주세요(새 파일을 받아 가요). */
const VERSION='gagyebu-v3';
const FILES=['./','index.html','css/app.css','js/config.js','js/engine.js','js/store.js','js/demo.js','js/photo.js','js/app.js','js/tools.js','js/settings.js','js/main.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin) return;   // 다른 주소(사진 분석 등)는 건드리지 않아요
  e.respondWith(fetch(r).then(res=>{const copy=res.clone();caches.open(VERSION).then(c=>c.put(r,copy));return res}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));
});
