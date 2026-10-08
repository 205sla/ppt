import assert from 'node:assert/strict';
export default async function verify({page}) {
  assert.equal(await page.locator('.slide').count(),26);
  assert.equal(await page.locator('[data-template-placeholder]').count(),0);
  assert.equal(await page.locator('[data-zoom]').count(),9);
  assert.equal(await page.locator('.reference-list > div').count(),11);
  assert.equal(await page.locator('.capture img').evaluateAll(imgs=>imgs.every(x=>x.complete&&x.naturalWidth>=1700)),true);
  await page.evaluate(()=>window.ppt205Deck.go(5));
  await page.locator('[data-step="2"]').click();
  assert.equal(await page.evaluate(()=>window.coopNextState().step),2);
  await page.locator('[data-play]').click();
  await page.waitForFunction(()=>window.coopNextState().step===3);
  await page.locator('[data-play]').click();
  assert.equal(await page.evaluate(()=>window.coopNextState().playing),false);
  await page.locator('[data-reset]').click();
  assert.equal(await page.evaluate(()=>window.coopNextState().step),0);
  await page.evaluate(()=>window.ppt205Deck.go(13));
  await page.locator('[data-contrast="training"]').click();
  assert.match(await page.locator('[data-contrast-text]').textContent(),/C−A/);
  await page.locator('[data-contrast="interaction"]').click();
  assert.match(await page.locator('[data-contrast-text]').textContent(),/상호작용/);
  await page.evaluate(()=>window.ppt205Deck.go(4));
  await page.locator('.slide.is-active [data-zoom]').click();
  assert.equal(await page.locator('dialog').evaluate(x=>x.open),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').evaluate(x=>x.open),false);
  await page.evaluate(()=>window.ppt205Deck.go(5));
  await page.locator('[data-step="1"]').click();
  await page.evaluate(()=>window.ppt205Deck.preparePrint());
  await page.evaluate(()=>window.ppt205Deck.preparePrint());
  assert.deepEqual(await page.evaluate(()=>window.coopNextState()),{step:3,playing:false,printing:true,contrast:'interaction'});
  await page.evaluate(()=>dispatchEvent(new Event('afterprint')));
  assert.equal(await page.evaluate(()=>window.coopNextState().step),1);
  for (const [width,height] of [[1280,720],[844,390]]) {
    await page.setViewportSize({width,height});
    for(let i=0;i<26;i++) {
      await page.evaluate(n=>window.ppt205Deck.go(n),i);
      const spills=await page.evaluate(()=>{
        const slide=document.querySelector('.slide.is-active'),box=slide.getBoundingClientRect();
        return [...slide.querySelectorAll('h2,h3,p,table,img,.data-flow,.factorial-grid')].filter(e=>!e.closest('.speaker-notes')&&e.getClientRects().length).filter(e=>{const r=e.getBoundingClientRect();return r.right>box.right+2||r.bottom>box.bottom+2||r.left<box.left-2;}).map(e=>e.tagName);
      });
      assert.deepEqual(spills,[],`${width}px slide ${i+1} overflow`);
    }
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.evaluate(()=>window.ppt205Deck.go(0));
}
