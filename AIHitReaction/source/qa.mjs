import assert from 'node:assert/strict';
export default async function verify({ page }) {
 assert.equal(await page.locator('.slide').count(),16);
 assert.equal(await page.locator('.deck-download').count(),0);
 await page.evaluate(()=>window.ppt205Deck.go(0));
 const before=await page.evaluate(()=>window.hitReactionPage.states[0].time);
 await page.waitForTimeout(260);
 assert.ok(await page.evaluate(t=>window.hitReactionPage.states[0].time>t,before),'autoplay');
 await page.waitForFunction(()=>Number(document.querySelector('[data-animation="skeleton"]').dataset.phase)>=1);
 assert.ok(await page.evaluate(()=>{
   const el=document.querySelector('[data-animation="skeleton"]');
   const upper=new DOMPoint(260,232).matrixTransform(el.querySelector('.upper-body').getCTM());
   const lower=new DOMPoint(260,232).matrixTransform(el.querySelector('.lower-body').getCTM());
   return Math.hypot(upper.x-lower.x,upper.y-lower.y)<.01;
 }),'rotating upper body must stay attached to pelvis');
 await page.locator('#motion-toggle').click();
 const frozen=await page.evaluate(()=>window.hitReactionPage.states[0].time);
 await page.waitForTimeout(180);
 assert.equal(await page.evaluate(()=>window.hitReactionPage.states[0].time),frozen,'pause');
 await page.locator('[data-chapter="1"]').click();
 await page.locator('#force-slider').fill('73');
 await page.locator('#force-slider').dispatchEvent('input');
 assert.equal(await page.locator('[data-force-value]').textContent(),'0.73');
 assert.equal(await page.evaluate(()=>window.hitReactionPage.manualCondition),true);
 await page.locator('#condition-auto').click();
 assert.equal(await page.evaluate(()=>window.hitReactionPage.manualCondition),false);
 assert.equal(await page.evaluate(()=>window.hitReactionPage.paused),false);
 for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   for(let i=0;i<16;i++){
     await page.evaluate(i=>window.ppt205Deck.go(i),i);
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document mobile overflow');
     assert.ok(await page.evaluate(()=>{const s=window.ppt205Deck.root;return s.scrollWidth<=s.clientWidth+1;}),'stage mobile overflow');
   }
   await page.locator('#menu-toggle').click();
   assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');
   await page.locator('[data-chapter="0"]').click();
   assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForTimeout(80);
 assert.equal(await page.evaluate(()=>window.hitReactionPage.paused),true);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:1920,height:1080});
 await page.evaluate(()=>window.ppt205Deck.go(0));
}
