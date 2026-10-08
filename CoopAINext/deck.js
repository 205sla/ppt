(() => {
  'use strict';
  window.addEventListener('DOMContentLoaded', () => {
    const scenes = [
      ['발판 A를 유지하는 중','사람이 발판 B로 이동한다. 기존 행동은 아직 유효하다.','정해진 시점에 상태를 확인','유효한 유지 행동을 계속'],
      ['동료가 발판 B를 벗어남','문이 닫혀 현재 계획의 전제가 달라진다. 변화 사건을 기록한다.','안전 검사 후 다음 호출 시점까지 대기','안전 검사 후 의미 있는 변화 사건을 병합'],
      ['행동 AI가 다시 선택','같은 공개 관측과 지시를 넣고, 새 행동을 검증해 실행한다.','주기 도달 시 새 행동을 선택','사건 또는 최대 대기 도달 시 선택'],
      ['결과를 비교하는 지점','발판 유지 → 동료 이탈 → 재판단 → 유효한 행동. 전체 경로를 기록한다.','변화부터 유효 실행까지의 지연과 호출 수','동일 지표로 비교하고 누락 사건도 기록']
    ];
    let step = 0, timer = null, printing = new URLSearchParams(location.search).has('print'), saved = null;
    const play = document.querySelector('[data-play]');
    const view = document.querySelector('.factorial');
    const contrastText = document.querySelector('[data-contrast-text]');
    const descriptions = {policy:'호출 효과: B−A, D−C를 비교한다.',training:'학습 효과: C−A, D−B를 비교한다.',interaction:'상호작용: (D−C)−(B−A)로 결합 효과를 본다.'};
    function show(n) {
      step = Math.max(0, Math.min(3,n));
      document.querySelector('[data-scenario-step]').textContent = `0${step+1} / 04`;
      ['[data-event-title]','[data-event-detail]','[data-periodic]','[data-event]'].forEach((selector,i) => document.querySelector(selector).textContent = scenes[step][i]);
      document.querySelectorAll('[data-step]').forEach(b => b.setAttribute('aria-pressed',String(Number(b.dataset.step) === step)));
    }
    function pause() { clearInterval(timer); timer=null; play.textContent='재생'; play.setAttribute('aria-pressed','false'); }
    function choose(type) {
      view.dataset.view=type; contrastText.textContent=descriptions[type];
      document.querySelectorAll('[data-contrast]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.contrast===type)));
    }
    play.addEventListener('click',()=>{
      if(timer){pause();return;} if(printing)return;
      play.textContent='일시 정지';play.setAttribute('aria-pressed','true');
      timer=setInterval(()=>{show((step+1)%4);},2300);
    });
    document.querySelector('[data-reset]').addEventListener('click',()=>{pause();show(0);});
    document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{pause();show(Number(b.dataset.step));}));
    document.querySelectorAll('[data-contrast]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.contrast)));
    const dialog=document.querySelector('.figure-dialog');
    document.querySelectorAll('[data-zoom]').forEach(b=>b.addEventListener('click',()=>{
      pause();const img=b.querySelector('img');dialog.querySelector('img').src=img.src;dialog.querySelector('img').alt=img.alt;
      dialog.querySelector('p').textContent=b.closest('figure').querySelector('figcaption a').textContent;
      dialog.showModal();
    }));
    document.querySelector('[data-close-figure]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
    dialog.addEventListener('keydown',e=>{e.stopPropagation();});
    window.addEventListener('deck:slidechange',()=>pause());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
    function prepare(){
      if(!printing)saved={step,contrast:view.dataset.view};
      printing=true;pause();if(dialog.open)dialog.close();show(3);choose('interaction');
      contrastText.textContent='호출: B−A / D−C · 학습: C−A / D−B · 상호작용: (D−C)−(B−A)';
    }
    window.addEventListener('deck:prepareprint',prepare);
    window.addEventListener('afterprint',()=>{
      if(new URLSearchParams(location.search).has('print'))return;
      printing=false;if(saved){show(saved.step);choose(saved.contrast||'policy');saved=null;}
    });
    show(0);choose('policy');if(printing)prepare();
    window.coopNextState=()=>({step,playing:!!timer,printing,contrast:view.dataset.view});
  });
})();
