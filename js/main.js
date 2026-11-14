/* 시작 — 모든 파일을 불러온 뒤에 화면을 그려요 */
GApp.boot();

/* 앱을 켜 둔 채로 날짜가 바뀌었다가 돌아오면, 그날의 달로 다시 열어요 (기록은 저장돼 있어서 안전해요) */
(function(){
  const loaded=new Date().toDateString();
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState!=='visible') return;
    if(new Date().getFullYear()<FIRST_YEAR) return;            // 2027년 전에는 1월 고정
    if(new Date().toDateString()===loaded) return;
    if(document.getElementById('layer').className==='open') return;   // 입력 중이면 건드리지 않아요
    location.reload();
  });
})();
