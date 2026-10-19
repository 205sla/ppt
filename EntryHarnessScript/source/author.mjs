import fs from 'node:fs';

const directory = new URL('../', import.meta.url);
const sections = JSON.parse(fs.readFileSync(new URL('script.json', import.meta.url), 'utf8'));
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
let page = 0;
const slides = sections.flatMap((section) => section.sentences.map((sentence, index) => {
    page += 1;
    const short = sentence.length < 24 ? ' reading-slide--short' : '';
    return `            <section class="slide reading-slide${short}${page === 1 ? ' is-active' : ''}" data-scene="${section.scene}" data-title="${section.title} ${index + 1}/${section.sentences.length}" aria-label="${section.title} · ${index + 1}번째 문장">
                <p class="scene-label">${section.scene} <span aria-hidden="true">/</span> ${section.title}</p>
                <div class="reading-area"><p class="reading-sentence">${escape(sentence)}</p></div>
                <p class="scene-position" aria-hidden="true">${index + 1} / ${section.sentences.length}</p>
                <aside class="speaker-notes"><p>카메라와 마이크로 직접 촬영하는 ${section.title} 구간. 큰 글씨의 대사만 읽습니다.</p>${index === section.sentences.length - 1 ? '<p>이 구간의 마지막 문장입니다. 촬영을 마친 뒤 다음 구간으로 이동합니다.</p>' : ''}</aside>
            </section>`;
})).join('\n');

fs.writeFileSync(new URL('index.html', directory), `<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="description" content="엔트리 하네스 발표의 카메라 촬영 대본. 도입, 다른 분야로의 확장, 마무리를 한 문장씩 읽는 13장 슬라이드.">
    <title>엔트리 하네스 발표 촬영 대본</title>
    <link rel="icon" href="../shared/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="../shared/deck.css">
    <link rel="stylesheet" href="styles.css">
    <script src="../shared/deck.js" defer></script>
    <script src="deck.js" defer></script>
</head>
<body>
    <nav class="scene-nav" aria-label="촬영 구간 바로가기">
        <button type="button" data-scene-target="S01" aria-current="true">도입</button>
        <button type="button" data-scene-target="S08">확장 방향</button>
        <button type="button" data-scene-target="S09">마무리</button>
    </nav>
    <a class="deck-download" href="downloads/EntryHarnessScript.pdf" download>PDF 다운로드 <span aria-hidden="true">↓</span></a>
    <main class="deck-shell">
        <div class="deck-stage" data-deck data-deck-title="엔트리 하네스 발표 촬영 대본" data-deck-footer="카메라 촬영 대본">
${slides}
        </div>
    </main>
    <nav class="deck-controls" aria-label="문장 이동">
        <button type="button" data-deck-previous title="이전 문장 (←)" aria-label="이전 문장">←</button>
        <span class="deck-count" data-deck-count aria-live="polite"></span>
        <button type="button" data-deck-next title="다음 문장 (→ / Space)" aria-label="다음 문장">→</button>
    </nav>
    <div class="reader-tools">
        <span class="key-hint">← → / Space 문장 이동</span>
        <button type="button" data-reader-fullscreen title="전체 화면 전환 (F)">전체 화면 <kbd>F</kbd></button>
    </div>
    <div class="deck-progress-track" aria-hidden="true"><div class="deck-progress" data-deck-progress></div></div>
    <aside class="notes-panel" data-deck-notes aria-label="촬영 메모"></aside>
</body>
</html>
`, 'utf8');
console.log(`EntryHarnessScript: ${sections.length}개 촬영 구간, ${page}문장 생성`);
