import assert from 'node:assert/strict';

export default async function verify({ page, baseUrl, deck }) {
  const visit = async (name) => page.evaluate((value) => {
    const root = document.querySelector(`[data-demo="${value}"]`);
    window.ppt205Deck.go(window.ppt205Deck.slides.indexOf(root));
  }, name);
  await page.waitForFunction(() => !!window.coopAIDeck);

  await visit('flow');
  assert.equal(await page.locator('[data-demo=flow] [data-ai-role]').count(), 2);
  assert.equal(await page.locator('[data-node=slow], [data-node=fast]').count(), 0);
  await visit('context');
  await page.click('[data-context="delegation"]');
  assert.match(await page.locator('[data-context-code]').innerText(), /session\.delegation\.created/);
  assert.match(await page.locator('[data-context-explain]').innerText(), /지시문이 없다/);
  await page.click('[data-context="quiet"]');
  const quiet = JSON.parse(await page.locator('[data-context-code]').innerText());
  assert.equal(quiet.type, 'session.thinking.append'); assert.equal(quiet.delegation_id, null); assert.equal(typeof quiet.content, 'string');
  await page.click('[data-context="speak"]');
  assert.equal(JSON.parse(await page.locator('[data-context-code]').innerText()).type, 'session.commentary.append');

  await visit('observe');
  const before = await page.locator('[data-observation-json]').innerText();
  await page.click('[data-observation="world"]');
  assert.equal(await page.locator('[data-observation-json]').innerText(), before, '전역 보기에서 AI 입력이 바뀌면 안 됨');
  assert.ok(!before.includes('lever'));

  await visit('decision'); await page.click('[data-request="ambiguous"]');
  assert.equal(JSON.parse(await page.locator('[data-decision-output]').innerText()).kind, 'ask');
  assert.equal(await page.locator('[data-action="ask_player"]').getAttribute('class'), 'selected');
  await page.click('[data-request="clear"]');
  assert.equal(JSON.parse(await page.locator('[data-decision-output]').innerText()).action_id, 'hold_blue');

  await visit('execute');
  for (let i=0; i<3; i++) await page.locator('[data-demo="execute"] [data-step]').click();
  const result = JSON.parse(await page.locator('[data-execution-output]').innerText());
  assert.equal(result.state, 'Holding'); assert.equal(result.task_complete, false);
  assert.equal(await page.locator('[data-scene="execute"] .door').evaluate(el => el.classList.contains('open')), true);

  await visit('cancel');
  await page.locator('[data-demo="cancel"] [data-step]').click();
  await page.locator('[data-demo="cancel"] [data-step]').click();
  assert.equal(await page.locator('[data-current-epoch]').innerText(), '8');
  assert.match(await page.locator('[data-gate-verdict]').innerText(), /폐기/);
  assert.match(await page.locator('[data-cancel-action]').innerText(), /실행 안 함/);
  await page.locator('[data-demo="cancel"] [data-step]').click();
  assert.match(await page.locator('[data-cancel-action]').innerText(), /노란/);

  await visit('initiative'); await page.click('[data-initiative="holding"]');
  assert.equal(await page.locator('[data-initiative-gate]').innerText(), '행동 유지');
  await page.click('[data-initiative="speaking"]');
  assert.equal(await page.locator('[data-initiative-gate]').innerText(), '제안 보류');

  await visit('parallel');
  await page.locator('#decision-duration').focus();
  await page.keyboard.press('End');
  assert.equal(await page.locator('#duration-output').innerText(), '8');
  const judgeStart = await page.locator('[data-bar="action-judge"]').evaluate(el => parseFloat(el.style.left));
  const judgeWidth = await page.locator('[data-bar="action-judge"]').evaluate(el => parseFloat(el.style.width));
  const engineStart = await page.locator('[data-bar="engine-current"]').evaluate(el => parseFloat(el.style.left));
  assert.equal(engineStart, 0); assert.ok(judgeStart > engineStart); assert.ok(judgeWidth > 60);
  assert.equal(await page.locator('[data-demo=parallel] .lane').count(), 3);

  await visit('flow'); await page.locator('[data-demo="flow"] [data-reset]').click();
  await page.locator('[data-demo="flow"] [data-play]').click();
  await page.waitForFunction(() => window.coopAIDeck.snapshot().frames.flow > 0);
  await page.locator('[data-demo="flow"] [data-play]').click();
  assert.deepEqual(await page.evaluate(() => window.coopAIDeck.snapshot().playing), []);
  await page.locator('[data-demo="flow"] [data-play]').click();
  await visit('connect');
  assert.deepEqual(await page.evaluate(() => window.coopAIDeck.snapshot().playing), [], '페이지 이동 때 재생 중지');

  const all = await page.evaluate(() => [...window.coopAIDeck.demos].map(([name, demo]) => ({name, count: demo.frames.length})));
  for (const width of [1280,1920]) {
    await page.setViewportSize({ width, height: Math.round(width*9/16) });
    for (const demo of all) {
      await visit(demo.name);
      for (let index=0; index<demo.count; index++) {
        await page.evaluate(({name,index}) => window.coopAIDeck.setStep(name,index), {name:demo.name,index});
        const overflow = await page.evaluate(() => {
          const root = document.querySelector('.slide.is-active'); const b=root.getBoundingClientRect();
          return [...root.querySelectorAll('h1,h2,h3,p,pre,li,button,strong,blockquote')].flatMap(el => {
            if (el.closest('.speaker-notes')) return [];
            const r=el.getBoundingClientRect(); const s=getComputedStyle(el);
            if (!r.width || !r.height || s.display==='none' || s.visibility==='hidden') return [];
            return r.bottom>b.bottom-12 || r.right>b.right+1 || r.left<b.left-1 || r.top<b.top-1 ? [el.textContent.slice(0,80)] : [];
          });
        });
        assert.deepEqual(overflow, [], `${demo.name} ${index} ${width}: 내용 넘침`);
      }
    }
  }
  const snapshot = await page.evaluate(() => window.coopAIDeck.snapshot());
  await page.evaluate(() => window.ppt205Deck.preparePrint());
  const once = await page.locator('[data-context-code]').innerText();
  await page.evaluate(() => window.ppt205Deck.preparePrint());
  assert.equal(await page.locator('[data-context-code]').innerText(), once, '인쇄 준비 반복 안정성');
  assert.match(once, /session\.thinking\.append/); assert.match(once, /session\.commentary\.append/);
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  const restored = await page.evaluate(() => window.coopAIDeck.snapshot());
  assert.deepEqual(restored.choices, snapshot.choices); assert.deepEqual(restored.frames, snapshot.frames);
  assert.equal(restored.printing,false);
  const deployed = await page.request.get(`${baseUrl}/${deck.slug}/downloads/${deck.slug}.pdf`);
  assert.ok(deployed.ok());
  console.log(`${deck.slug}: API 형식, 관찰 필터, 질문, 유지, 늦은 응답, 재생·인쇄 복귀 검증 통과`);
}
