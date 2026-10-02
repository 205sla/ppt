(() => {
 'use strict';
 const proto = window.PPT205?.Deck.prototype;
 if (!proto) return;
 const originalGo = proto.go;
 proto.go = function(index, options = {}) {
   originalGo.call(this, index, options);
   if (this.isPrint || document.documentElement.classList.contains('print-view')) return;
   this.slides.forEach(slide => { slide.setAttribute('aria-hidden', 'false'); slide.inert = false; });
   if (!options.fromScroll) this.root.scrollTop = this.slides[this.current].offsetTop;
 };
 const reduced = matchMedia('(prefers-reduced-motion: reduce)');
 let paused = reduced.matches, printing = false, deck, timer = 0, last = 0, savedPrint;
 let animations = [], manualCondition = false;
 const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
 const captions = ['기본 자세를 유지합니다.', '어깨에 충격이 들어옵니다.', '상체의 회전 보정을 적용합니다.', '보정을 줄이며 기본 동작으로 복귀합니다.'];
 function render(anim) {
   const { el, kind, time } = anim;
   const duration = kind === 'condition' ? 8500 : 9200;
   const u = (time % duration) / duration;
   el.dataset.progress = u.toFixed(4);
   if (kind === 'skeleton' || kind === 'blend') {
     const phase = u < .18 ? 0 : u < .31 ? 1 : u < .59 ? 2 : 3;
     const response = u < .2 ? 0 : Math.sin(clamp((u - .2) / .75, 0, 1) * Math.PI) * Math.exp(-Math.max(0, u - .43) * 2.5);
     const angle = 19 * response;
     const upper = el.querySelector('.upper-body');
     upper.setAttribute('transform', `rotate(${angle.toFixed(2)} 260 232)`);
     el.querySelector('.arm-left').setAttribute('transform', `rotate(${(14 * response).toFixed(2)} 217 135)`);
     el.querySelector('.arm-right').setAttribute('transform', `rotate(${(-10 * response).toFixed(2)} 303 135)`);
     const hit = phase === 1 ? 1 : phase === 2 ? .25 : 0;
     el.querySelector('.impact-mark').style.opacity = hit;
     el.querySelector('.impulse-arrow').style.opacity = phase === 1 ? 1 : 0;
     el.querySelector('[data-caption]').textContent = captions[phase];
     const progress = el.querySelector('.time-track i');
     if (progress) progress.style.width = `${u * 100}%`;
     el.dataset.phase = phase;
   } else if (kind === 'condition') {
     if (!manualCondition) {
       const value = Math.round(50 - 35 * Math.cos(u * Math.PI * 2));
       document.getElementById('force-slider').value = value;
       force(value);
     }
   } else if (kind === 'pair') {
     const active = Math.floor(u * 7);
     el.querySelectorAll('.frame-track').forEach(track => track.querySelectorAll('i').forEach((n,i) => n.classList.toggle('active', i === active)));
   } else if (kind === 'flow' || kind === 'network') {
     const nodes = [...el.querySelectorAll(kind === 'flow' ? '.flow-step' : '.network-layer')];
     const active = Math.floor(u * nodes.length);
     nodes.forEach((n,i) => n.classList.toggle('active', i === active));
   } else if (kind === 'split') {
     el.querySelectorAll('.test').forEach((n,i) => n.classList.toggle('active', i === (u < .5 ? 0 : 1)));
   }
 }
 function force(value) {
   document.querySelector('[data-force-value]').textContent = (value / 100).toFixed(2);
   document.querySelector('.condition-fill').style.width = value + '%';
 }
 function stop() { cancelAnimationFrame(timer); timer = 0; last = 0; }
 function play() {
   if (timer || paused || printing || document.hidden || !deck || deck.isPrint) return;
   timer = requestAnimationFrame(tick);
 }
 function tick(now) {
   timer = 0;
   if (paused || printing || document.hidden || !deck || deck.isPrint) { last = 0; return; }
   const delta = last ? Math.min(now - last, 80) : 0;
   last = now;
   const slide = deck.slides[deck.current];
   animations.forEach(anim => { if (slide.contains(anim.el)) { anim.time += delta; render(anim); } });
   play();
 }
 function syncNav(index) {
   document.querySelectorAll('[data-chapter]').forEach(link => {
     if (Number(link.dataset.chapter) === index) link.setAttribute('aria-current','page');
     else link.removeAttribute('aria-current');
   });
 }
 function updatePause() {
   const button = document.getElementById('motion-toggle');
   if (button) {
     button.setAttribute('aria-pressed',String(paused));
     button.textContent = paused ? '자동재생 시작' : '자동재생 일시정지';
   }
   paused ? stop() : play();
 }
 function printState() {
   if (!savedPrint) savedPrint = animations.map(a => a.time);
   printing = true; stop();
   animations.forEach(a => { a.time = 3950; render(a); });
 }
 window.addEventListener('deck:prepareprint', printState);
 window.addEventListener('afterprint', () => {
   if (deck?.isPrint) return;
   printing = false;
   if (savedPrint) animations.forEach((a,i) => { a.time = savedPrint[i]; render(a); });
   savedPrint = null; updatePause();
 });
 window.addEventListener('deck:slidechange', e => { syncNav(e.detail.index); stop(); play(); });
 window.addEventListener('DOMContentLoaded', () => {
   deck = window.ppt205Deck;
   document.querySelectorAll('.frame-track').forEach(track => {
     for (let i=0;i<7;i++) { const n=document.createElement('i'); n.setAttribute('aria-hidden','true'); track.append(n); }
   });
   animations = [...document.querySelectorAll('[data-animation]')].map(el => ({ el,kind:el.dataset.animation,time:reduced.matches?3950:0 }));
   animations.forEach(render);
   if (deck.isPrint) printState();
   syncNav(deck.current);updatePause();
   document.getElementById('motion-toggle').addEventListener('click',()=>{paused=!paused;updatePause();});
   document.getElementById('force-slider').addEventListener('input',e=>{manualCondition=true;force(Number(e.target.value));});
   document.getElementById('condition-auto').addEventListener('click',()=>{manualCondition=false;paused=false;updatePause();});
   const menu=document.getElementById('menu-toggle');
   function closeNav(){document.body.classList.remove('nav-open');menu.setAttribute('aria-expanded','false');}
   menu.addEventListener('click',()=>{const open=document.body.classList.toggle('nav-open');menu.setAttribute('aria-expanded',String(open));});
   document.querySelectorAll('[data-chapter]').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();deck.go(Number(link.dataset.chapter));closeNav();}));
   deck.root.addEventListener('click',closeNav);
   document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav();});
   let scrollFrame=0;
   deck.root.addEventListener('scroll',()=>{
     if(printing||deck.isPrint||scrollFrame)return;
     scrollFrame=requestAnimationFrame(()=>{
       scrollFrame=0;if(printing||deck.isPrint)return;
       const top=deck.root.scrollTop+Math.min(160,deck.root.clientHeight*.2);
       let next=0;
       deck.slides.forEach((s,i)=>{if(s.offsetTop<=top)next=i;});
       if(next!==deck.current)deck.go(next,{fromScroll:true});
     });
   },{passive:true});
   document.addEventListener('visibilitychange',()=>document.hidden?stop():play());
   reduced.addEventListener('change',e=>{if(e.matches){paused=true;updatePause();}});
   window.hitReactionPage=Object.freeze({get paused(){return paused;},get printing(){return printing;},get manualCondition(){return manualCondition;},get states(){return animations.map(a=>({kind:a.kind,time:a.time}));}});
 });
})();
