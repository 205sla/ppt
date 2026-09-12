(() => {
    'use strict';
    // 이 자료의 버튼과 애니메이션을 여기에 추가합니다.
    window.addEventListener('deck:slidechange', ({ detail }) => {
        // detail.slide는 현재 슬라이드입니다. 이전 슬라이드의 애니메이션을 멈추세요.
    });
    window.addEventListener('deck:prepareprint', () => {
        // 애니메이션을 멈추고 PDF에 담을 장면을 설정하세요. 여러 번 호출해도 같은 결과가 나와야 합니다.
    });
})();
