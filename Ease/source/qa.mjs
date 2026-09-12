export default async function verifyEase({ page, baseUrl, deck }) {
    for (const file of ['ease-step1_001.ent', 'ease-step2_001.ent', 'ease-linear_001.ent', 'ease-in_001.ent', 'ease-out_001.ent', 'ease-in-out_001.ent']) {
        const response = await page.request.get(`${baseUrl}/${deck.slug}/downloads/${file}`);
        if (!response.ok() || (await response.body()).length < 8_000) throw new Error(`${file}: 엔트리 파일 다운로드 오류`);
    }
    await page.evaluate(() => window.ppt205Deck.go(window.ppt205Deck.slides.findIndex((slide) => slide.querySelector('[data-race-play-proxy]'))));
    await page.locator('[data-race-play-proxy]').click();
    await page.waitForTimeout(400);
    if (!await page.locator('[data-race][data-autoplay="true"] .runner').first().evaluate((runner) => parseFloat(runner.style.left) > 0)) throw new Error('이징 경주 재생 실패');
    await page.evaluate(() => window.ppt205Deck.go(window.ppt205Deck.slides.findIndex((slide) => slide.querySelector('[data-matching]'))));
    await page.locator('.match-row').first().locator('[data-match-choice="easeOut"]').click();
    if (!await page.locator('.match-row').first().locator('[data-match-choice="easeOut"]').evaluate((button) => button.classList.contains('is-correct'))) throw new Error('이징 퀴즈 피드백 실패');
    console.log('Ease 전용 검사: 엔트리 파일 6개, 경주, 퀴즈 통과');
}
