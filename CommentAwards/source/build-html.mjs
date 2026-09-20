import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), context);
const content = context.window.COMMENT_AWARDS_CONTENT;
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const ordinals = ['첫 번째', '두 번째', '세 번째'];
const field = (name, index, fallback, tag = 'span', classes = '') => {
  const value = content.winners[index]?.[name]?.trim();
  const encoded = escape(value || fallback).replace(/ (?=\n)/g, '&#32;');
  return `<${tag} class="${classes}" data-person="${index}" data-field="${name}"${value ? '' : ' data-template-placeholder'}>${encoded}</${tag}>`;
};
const backdrop = '<div class="scene-background" aria-hidden="true"></div>';
const awards = ordinals.map((ordinal, index) => `
      <section class="slide suspense-slide" data-kind="suspense" data-person="${index}" data-title="${ordinal} 수상자 공개 전">
        ${backdrop}
        <div class="slide-content centered">
          <p class="overline">${ordinal} 수상자</p>
          <h2 class="suspense-title">잠시 후 공개합니다</h2>
          <div class="countdown" aria-live="off" aria-label="수상자 공개 카운트다운">?</div>
        </div>
        <aside class="speaker-notes">${ordinal} 수상자를 공개합니다. 세 분 모두 같은 상이며 소개 순서는 등수가 아닙니다.</aside>
      </section>
      <section class="slide reveal-slide" data-kind="reveal" data-person="${index}" data-title="${ordinal} 수상자">
        ${backdrop}
        <div class="slide-content centered">
          <p class="overline">${ordinal} 수상자</p>
          ${field('name', index, '[닉네임 입력]', 'h2', 'winner-name')}
          <p class="reveal-celebration">축하합니다!</p>
          ${field('reason', index, '[선정 이유를 입력해 주세요]', 'p', 'winner-reason')}
        </div>
        <aside class="speaker-notes">닉네임을 또렷하게 읽고 박수를 함께 보냅니다.</aside>
      </section>
      <section class="slide evidence-slide" data-kind="evidence" data-person="${index}" data-title="${ordinal} 수상자의 댓글">
        ${backdrop}
        <div class="slide-content evidence-content">
          <h2 class="evidence-title">이 댓글을 기억합니다</h2>
          <div class="quote-mark" aria-hidden="true">“</div>
          ${field('comment', index, '[대표 댓글을 여기에 넣어 주세요]', 'blockquote', 'featured-comment')}
          <p class="comment-credit">${field('name', index, '[닉네임 입력]')}<span class="credit-gap">님의 댓글</span></p>
          <p class="comment-project">${field('project', index, '[댓글을 남긴 작품 제목]')}</p>
        </div>
        <aside class="speaker-notes">대표 댓글을 읽고 작품을 구체적으로 살핀 부분을 짧게 소개합니다.</aside>
      </section>`).join('');

const editors = ordinals.map((ordinal, index) => `
          <fieldset>
            <legend>${ordinal} 수상자</legend>
            <div class="editor-row"><label>닉네임<input name="winner-${index}-name" maxlength="24" autocomplete="off" placeholder="수상자 이름"></label><label>작품 제목<input name="winner-${index}-project" maxlength="60" autocomplete="off" placeholder="댓글을 남긴 작품"></label></div>
            <label>선정 이유<input name="winner-${index}-reason" maxlength="90" autocomplete="off" placeholder="수상 이유를 한 문장으로"></label>
            <label>대표 댓글<textarea name="winner-${index}-comment" maxlength="220" rows="3" placeholder="확인한 댓글 원문을 입력해 주세요"></textarea></label>
          </fieldset>`).join('');

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="세 사람을 한 명씩 공개하는 자동 재생 댓글 시상식">
  <title>좋은 댓글 시상식</title>
  <link rel="icon" href="../shared/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../shared/deck.css">
  <link rel="stylesheet" href="styles.css">
  <script src="content.js" defer></script>
  <script src="../shared/deck.js" defer></script>
  <script src="deck.js" defer></script>
</head>
<body class="awards-ready">
  <main class="deck-shell">
    <div class="deck-stage" data-deck data-deck-title="좋은 댓글 시상식" data-deck-footer="">
      <section class="slide opening-slide is-active" data-kind="opening" data-title="좋은 댓글 시상식">
        ${backdrop}
        <div class="slide-content centered">
          <p class="overline" data-event-label>${escape(content.eventLabel)}</p>
          <h1>좋은 댓글<br><span>시상식</span></h1>
          <p class="opening-subtitle">친구의 작품을 자세히 보고<br>마음을 담아 댓글을 남긴 세 사람</p>
          <div class="start-area">
            <button class="start-button" type="button" data-awards-start>발표 시작 <span aria-hidden="true">↗</span></button>
            <p class="start-hint">한 번 누르면 마지막까지 자동으로 진행됩니다</p>
          </div>
        </div>
        <aside class="speaker-notes">세 분을 차례로 소개하는 댓글 시상식입니다. 모두 같은 상으로 함께 축하합니다.</aside>
      </section>
      <section class="slide introduction-slide" data-kind="introduction" data-title="오늘의 주인공">
        ${backdrop}
        <div class="slide-content centered">
          <p class="overline">오늘의 주인공</p>
          <h2><span class="intro-line">작품을 살피고</span><span class="intro-line">좋은 말을 건넨</span><span class="intro-line gold">세 사람</span></h2>
          <p class="selection-criteria">구체적인 관찰 · 도움이 되는 제안 · 따뜻한 표현</p>
        </div>
        <aside class="speaker-notes">2026년 9월 20일 수집한 원댓글 71개와 답글 29개를 검토했습니다. 친구 작품의 구체적인 특징을 짚은 관찰, 제작에 도움이 되는 제안, 따뜻한 표현을 중심으로 선정했습니다. 단순한 댓글 수로 순위를 매기지 않았으며 세 분 모두 같은 상입니다.</aside>
      </section>
      ${awards}
      <section class="slide finale-slide" data-kind="finale" data-title="모두 축하합니다">
        ${backdrop}
        <div class="slide-content centered">
          <p class="overline">좋은 댓글을 남긴 여러분에게</p>
          <h2>큰 박수를<br>보냅니다</h2>
          <ul class="final-winners" aria-label="오늘의 수상자">
            ${ordinals.map((_ordinal, i) => `<li>${field('name', i, `[수상자 ${i + 1}]`, 'span', 'final-name')}</li>`).join('')}
          </ul>
          <p class="closing-line">함께 보고, 함께 나누는 우리 반</p>
        </div>
        <aside class="speaker-notes">세 분 모두 축하합니다. 상품을 전달하고 마지막 화면에서 함께 박수를 보냅니다.</aside>
      </section>
    </div>
  </main>
  <nav class="awards-toolbar" aria-label="발표 조작">
    <button type="button" data-deck-previous title="이전 장면 (←)" aria-label="이전 장면">←</button>
    <span data-deck-count class="slide-count"></span>
    <button type="button" data-deck-next title="다음 장면 (→)" aria-label="다음 장면">→</button>
    <span class="toolbar-separator" aria-hidden="true"></span>
    <button type="button" data-awards-toggle>자동 재생</button>
    <button type="button" data-awards-restart title="처음부터 (R)">처음부터</button>
    <button type="button" data-awards-sound aria-pressed="true" title="소리 켜기·끄기 (M)">소리 켜짐</button>
    <button type="button" data-awards-fullscreen title="전체 화면 (F)">전체 화면</button>
    <button type="button" data-awards-edit title="내용 입력 (E)">내용 입력</button>
  </nav>
  <div class="playback-progress" aria-hidden="true"><div data-awards-progress></div></div>
  <p class="playback-status" data-playback-status aria-live="polite">발표 대기</p>
  <aside class="notes-panel" data-deck-notes aria-label="발표자 노트"></aside>
  <dialog class="content-editor" aria-labelledby="editor-title">
    <form id="content-form">
      <div class="editor-heading"><div><h2 id="editor-title">발표 내용 입력</h2><p>내용과 재생 시간을 조정할 수 있습니다. 변경은 이 브라우저에만 저장됩니다.</p></div><button type="button" data-editor-close aria-label="내용 입력 닫기">닫기</button></div>
      <div class="editor-body">
        <label>행사 표기<input name="eventLabel" maxlength="40" autocomplete="off"></label>
        ${editors}
        <fieldset class="timing-fields"><legend>재생 시간</legend><div class="editor-row"><label>닉네임 공개 화면 <span>초</span><input name="revealDuration" type="number" min="6" max="40" step="1"></label><label>대표 댓글 화면 <span>초</span><input name="evidenceDuration" type="number" min="8" max="60" step="1"></label></div><p class="editor-help">발표 시작 뒤 약 <span data-total-duration>1분 50초</span> 동안 자동 진행하며 마지막 화면에 머뭅니다.</p></fieldset>
        <p class="editor-message" data-editor-message role="status"></p>
      </div>
      <div class="editor-actions"><button type="button" data-config-import>내용 불러오기</button><input type="file" accept="application/json,.json" data-config-file hidden><button type="button" data-config-export>내용 파일 저장</button><button type="submit" class="primary-action">적용</button></div>
    </form>
  </dialog>
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), html.replace(/[ \t]+$/gm, ''));
console.log('CommentAwards: 12개 슬라이드 HTML 생성');
