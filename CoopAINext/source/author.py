from pathlib import Path
import json, html, shutil, re

root=Path(__file__).parent
out=root.parent if root.name=='source' else root/'build'
refs=json.loads((root/'references.json').read_text(encoding='utf8'))
by={r['key']:r for r in refs}
caps={r['key']:r for r in json.loads((out/'source'/'capture-manifest.json').read_text(encoding='utf8'))}
slides=[]
def cite(*keys):
    return ' · '.join(f'<a href="{by[k]["url"]}" target="_blank" rel="noopener">[{by[k]["id"]}] {by[k]["authors"]}, {by[k]["venue"]}</a>' for k in keys)
def fig(k,alt):
    r=caps[k]
    return f'''<figure class="paper-figure"><button type="button" class="capture" data-zoom aria-label="{html.escape(alt)} 확대"><img src="{r['image']}" alt="{html.escape(alt)}" width="1800" loading="eager"></button><figcaption><a href="{r['pdf']}#page={r['pdf_page']}" target="_blank" rel="noopener">[{r['id']}] {r['authors']} · {r['venue']} · PDF {r['pdf_page']}쪽, {r['figure']}</a><span>원문 그림 캡처 · 클릭하면 확대</span></figcaption></figure>'''
def slide(title,body,notes='',eyebrow='',cls='',source=''):
    i=len(slides)+1
    slides.append(f'''<section class="slide {cls} {'is-active' if i==1 else ''}" data-title="{html.escape(title)}"><p class="eyebrow">{eyebrow or '연구 설계 · 제안'}</p><h2>{title}</h2><div class="slide-body">{body}</div>{f'<p class="source-line">{source}</p>' if source else ''}<aside class="speaker-notes"><p>{notes}</p></aside></section>''')
def rows(items):
    return '<div class="reason-list">'+''.join(f'<div><h3>{a}</h3><p>{b}</p></div>' for a,b in items)+'</div>'
def table(headers,items,cls=''):
    return '<table class="'+cls+'"><thead><tr>'+''.join('<th>'+h+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+c+'</td>' for c in row)+'</tr>' for row in items)+'</tbody></table>'

slide('통합 다음에는,<br>협동의 효과를 증명하기', '''<p class="cover-question">상황이 바뀔 때 <strong>언제 다시 판단하고,</strong><br>학습으로 <strong>무엇이 나아지는가?</strong></p><div class="cover-bottom"><p>협동 게임 AI의 남은 반학기 연구와 응용</p><p>1팀 더미 · 2026.10.08<br><span>문헌 근거 → 비교 실험 → 응용 시연</span></p></div>''',
 '교수님 상담과 10월 8일 통합 상태를 바탕으로 남은 학기의 권고안을 설명한다. 연구 초점은 10월 2일 확정한 상황 기반 재판단과 행동 AI 파인튜닝이다. 이 자료의 세부 일정·시나리오·응용은 제안이며 구현 성과와 구분한다. 본문 24장과 참고문헌 2장. 방향키로 이동, N으로 발표자 노트, 그림 클릭으로 원문 캡처 확대. 전체 검토 20분 또는 1–6, 10, 14–15, 20, 22–24쪽 중심으로 12분 발표.',eyebrow='CAPSTONE DESIGN · 남은 반학기 계획',cls='cover')

slide('교수님이 요구한 것은<br>목표와 근거가 연결되는 설명',table(['상담의 핵심 요구','이번 계획에서 보여 줄 것'],[
 ['최종 목표·연구 질문을 먼저 제시','재판단 방식 × 학습 여부의 효과를 비교'],
 ['단순 기능 연결·JSON 출력 이상의 기여','실패를 재현하는 시나리오와 자동 판정'],
 ['미리 알려 준 정보와 추론을 구분','관측·관계·행동 후보의 공개 범위 명세'],
 ['복잡한 협동·실패 상황을 검증','목표 변경, 역할 충돌, 선행 조건 위반'],
 ['전체 계획 속 이번 주 위치를 설명','통합 완료 → 계측 → 실험 → 결과 분석']]),
 '2026-10-02 상담 정리의 요약이며 직접 인용이 아니다. 16:31–17:38 목표와 전체 계획, 09:01–09:19 및 11:40–13:00 단순 연결의 기여, 10:32–15:42 수동 설정·추출과 정보 제공 범위, 19:36–20:37 복잡한 협동 상황. 모델 보완 방법 조사를 요청했으나 특정 기법을 교수님이 지시했다고 해석하지 않는다. 오른쪽은 이번 조사에서 구체화한 제안이다.',eyebrow='출발점 · 10/2 상담 요지',source='내부 근거: 2026-10-02 교수상담 정리 · 타임스탬프와 원문 경로는 발표자 노트·제작 기록에 보관')

slide('통합 기반은 있다.<br>성능 비교와 사람 플레이 검증이 남았다.', '''<div class="two-columns"><div><h3>현재 직접 확인한 범위</h3><p>경민의 퍼즐·상태 → 조정기 →<br>준영의 Qwen·Unreal 실행기</p><div class="fact-numbers"><p><strong>107</strong><span>Node 회귀 시험</span></p><p><strong>24</strong><span>실제 Qwen + Unreal</span></p></div><p class="small">브라우저 12 · 네이티브 3 · Editor/Game 빌드 통과</p></div><div><h3>다음에 확보할 근거</h3><ul><li>최신 수정 후 Live API 재시험</li><li>사람 마이크·끼어들기·재접속 플레이</li><li>주기 / 사건 재판단의 반복 비교</li><li>행동 모델 학습 전후의 미지 과제 성능</li></ul></div></div><p class="takeaway">시험 통과 개수는 게임 성공률이나 연구 성능 수치가 아니다.</p>''',
 '코드 기준 bd92d2f65d5801d51dda78a4924bf1a4f5ebc615. 브라우저는 모의 Live와 합성 미디어, 실제 Qwen+Unreal은 시험용 플레이어 위치 이동을 포함한다. 앞선 9753177 회차의 실제 GPT Live 합성 한국어 음성 8개 통과는 최신 수정의 Live 재시험이 아니다. 현재 상태는 작성자가 지정한 퍼즐 영역의 구조화 관측이며 영상 인식이 아니다. 로컬 LM Studio 식별자는 qwen/qwen3-4b-2507. 서로 다른 시험 종류의 수를 합해 성능으로 쓰지 않는다.',eyebrow='확인된 상태 · 2026.10.08',source='<a href="https://github.com/205sla/CapstoneDesign/commit/bd92d2f65d5801d51dda78a4924bf1a4f5ebc615" target="_blank" rel="noopener">구현 기준: CapstoneDesign main · bd92d2f</a>')

slide('권고: 핵심 비교를 끝내고,<br>응용은 같은 구조로 하나만 확장',table(['우선순위','남은 작업','판단'],[
 ['1 · 먼저','반복 실행·이벤트 로그·성공/실패 판정','모든 연구 결과의 기반'],
 ['2 · 핵심','상황 기반 재판단 + 행동 AI LoRA','기존 확정 주제를 검증 가능하게 완성'],
 ['3 · 보조','정보 공개 수준·모호한 지시의 질문','주 실험과 분리한 작은 추가 비교'],
 ['4 · 응용','가상 작업 훈련 시나리오 1개','새 플랫폼 없이 활용 가능성 시연'],
 ['이번 학기 보류','실물 로봇·새 비전 모델·대규모 사용자 연구','장치·데이터·평가 범위가 크게 증가']]),
 '재판단과 파인튜닝을 제거하거나 주제를 바꾸는 제안이 아니다. 나열된 모든 옵션을 구현하지 말고 핵심 두 변수에 충분한 비교 예산을 배분한다. 가상 훈련과 사용자 경험 개선은 공학적 성능 지표 외에도 응용 가능성을 설명할 수 있으나 교육 효과나 실물 로봇 성능은 별도 검증이 필요하다.',eyebrow='우선순위 · 실행 제안')

slide('DPT-Agent: 추론을 기다리는 동안에도<br>실행이 이어지는 구조를 참고',f'''<div class="evidence-layout">{fig('dpt','DPT-Agent의 비동기 반성·마음 이론과 코드 정책·상태기계 실행 구조')}<div>{rows([('가져올 원리','추론과 실행을 분리하고,<br>실행 중 관측을 다시 반영한다.'),('우리의 비교 질문','같은 실행기에서 모델 호출 시점을<br>바꾸면 성공·지연·비용이 달라질까?'),('해석의 경계','원 논문도 상황 변화에 대응한다.<br>이벤트 반응 자체를 새 기법이라 주장하지 않는다.')])}</div></div>''',
 'Zhang 등, ACL 2025. Figure 3은 System 2의 ToM·비동기 reflection과 System 1의 code-as-policy·FSM·executor를 보여 준다. 원문 4.2.2의 상태 전이는 환경 변화에 반응하고, 코드 정책 생성도 별도 주기가 있다. 따라서 원 논문을 단순한 고정 주기 기준으로 묘사하지 않는다. 우리 두 AI는 대화 AI와 행동 AI이며 DPT의 System 1/2에 일대일 대응하지 않는다. 조정기·기억·실행기는 일반 코드다. 완전 재현이나 우월성 주장이 아니라 설계 원리와 통제 실험의 참고다.',eyebrow='R1 · 구조의 기준 논문')

slide('재판단 정책을 바꾸면<br>이 장면에서 무엇이 달라져야 할까?', '''<div class="scenario-head"><p class="small">설명용 가상 예시 · 성능 측정 결과 아님</p><div class="interactive-controls"><button type="button" data-play>재생</button><button type="button" data-reset>처음</button></div></div><div class="scenario-grid"><div><p class="scenario-step" data-scenario-step>01 / 04</p><h3 data-event-title>발판 A를 유지하는 중</h3><p data-event-detail>사람이 발판 B로 이동한다. 기존 행동은 아직 유효하다.</p><p class="small">공개 관측 → 정책 판단 → 행동 AI → 실행 결과</p></div><div><table class="scenario-table"><thead><tr><th>정책</th><th>현재 장면의 동작</th></tr></thead><tbody><tr><td>주기적 호출</td><td data-periodic>정해진 시점에 상태를 확인</td></tr><tr><td>사건 기반 호출</td><td data-event>유효한 유지 행동을 계속</td></tr></tbody></table><p class="guard-note">두 조건 모두 같은 취소·유효성 검사 적용</p></div></div><div class="step-buttons" aria-label="예시 장면 선택"><button type="button" data-step="0" aria-pressed="true">1 유지</button><button type="button" data-step="1" aria-pressed="false">2 변화</button><button type="button" data-step="2" aria-pressed="false">3 판단</button><button type="button" data-step="3" aria-pressed="false">4 검증</button></div><p class="takeaway">제안 정책: 의미 있는 변화 + 중복 병합 + 호출 상한 + 최대 대기 시간</p>''',
 '핵심 가설 H1: 같은 공개 정보와 실행 보호 장치에서 사건 기반 호출이 변화 대응을 개선하고 불필요한 호출을 줄일 수 있다. 빠른 고정 주기보다 항상 낫다는 보장은 없다. 사건은 목표 변경, 현재 행동의 전제 붕괴, 실패 피드백 등이며 위치의 미세한 변화마다 호출하지 않는다. 취소는 양쪽 모두 즉시 적용하고, 새 행동을 선택하는 호출 시점을 비교한다. maximum wait를 가진 하이브리드임을 명시한다. debounce, 최대 대기, 주기 후보는 validation에서 고정한다. 화면은 동작 예시이며 특정 초 단위 효과를 만들어 내지 않는다.',eyebrow='가설 H1 · 호출 시점',cls='scenario-slide')

slide('ADAPT: 물체가 있다는 것과<br>지금 쓸 수 있다는 것은 다르다',f'''<div class="evidence-layout">{fig('adapt','DynAfford에서 고정 사용 가능 조건과 변화하는 사용 가능 조건을 비교한 그림')}<div>{rows([('논문에서 다룬 문제','물체의 사용 가능 조건이 바뀌고,<br>지시에 빠진 상식적 제약이 존재한다.'),('게임에 적용','문·발판의 존재 정보와<br>현재 점유·잠김·통과 가능 여부를 분리한다.'),('범위 유지','이 논문은 시각·행동 추론 환경이다.<br>우리 JSON 관측을 비전 인식으로 부르지 않는다.')])}</div></div>''',
 'Chen 등, ACL 2026. DynAfford 벤치마크와 ADAPT 방법을 구분한다. 동적 affordance와 불완전한 지시를 문제 정의에 참고한다. 논문의 학습·성능 수치를 우리 Qwen 또는 구조화 JSON에 옮겨 적용할 수 없다. 작동 중 상태 변화와 객체 정적 속성의 구분은 우리 시나리오 설계에 바로 적용할 수 있다.',eyebrow='R3 · 상태와 사용 가능 조건')

slide('교수님 질문에 답하려면<br>모델에 주는 정보를 먼저 명세해야 한다',table(['공개 조건 제안','모델이 받는 것','검증할 질문'],[
 ['O · 관측','보이는 객체·점유·문 상태 + 공통 행동 규격','현재 정보만으로 선택 가능한가?'],
 ['O + R · 관계','O + 작성자가 설정한 연결·선행 관계','관계 정보를 주면 무엇이 달라지는가?'],
 ['O + R + H · 추가 힌트','위 정보 + 정답 경로에 가까운 단계 힌트','풀이를 미리 알려 준 영향은 얼마나 큰가?']])+'''<p class="takeaway">핵심 2×2 실험은 정보 조건 하나를 고정한다.<br>정보 수준 비교는 별도 실험으로 진행한다.</p><p class="small">감사 대상: 후보 행동 필터, exit_id, 관계명, 예시 정답, 메모리, 지연 도착한 관측</p>''',
 '현재 초기 JSON과 실시간 후보에는 작성자 관계·실행 가능 조건이 포함될 수 있으므로 실제 payload를 열어 누설 여부를 먼저 점검한다. O는 제한 관측 실험의 제안으로 아직 구현되어 있지 않다. 행동 규격과 안전 검사는 동일하게 두며, 후보를 생성할 때 숨겨진 정답을 써서 이미 풀이가 유출되지 않게 한다. 관측 수준을 낮추더라도 실행 검증은 끄지 않는다. 정보가 부족해 답이 유일하지 않은 사례는 질문 가능한 과제 또는 풀 수 없음으로 사전에 정의한다. 현재 장면을 기억한 학습 데이터가 test 맵을 노출하지 않게 해야 한다.',eyebrow='정보 계약 · 추가 통제 실험',source=cite('adapt','partnr'))

slide('PARTNR: 협동의 난도를<br>규칙과 판정 조건으로 설계한다',f'''<div class="evidence-layout">{fig('partnr','PARTNR의 가정 내 협동 과제와 자동 평가·인간 협력 구조')}<div>{rows([('참고할 요소','공간·순서·역할별 제약이 있는 과제와<br>실행 가능한 평가 조건.'),('우리의 작은 벤치마크','맵 수를 늘리기 전에<br>같은 맵에 실패 원인을 통제해 주입한다.'),('판정의 분리','모델이 완료라고 말한 것과<br>실제 게임 목표 달성을 따로 기록한다.')])}</div></div>''',
 'Chang 등, ICLR 2025. PARTNR은 embodied multi-agent planning/reasoning을 평가하며 평가 함수로 과제 완료를 판정한다. 연구 규모 자체를 재현할 필요는 없다. 우리의 판정기는 게임의 실제 상태에서 통과 조건을 확인하는 일반 코드로 두고, 모델의 텍스트만으로 성공 처리하지 않는다. 역할·시간 제약에 관한 설계 원리를 가져오는 것이며 다른 벤치마크의 성공률을 직접 비교하지 않는다.',eyebrow='R2 · 반복 가능한 과제')

slide('기존 퍼즐에서 시작할<br>다섯 가지 시험 장면',table(['장면','의도적으로 바꿀 조건','자동 판정의 예'],[
 ['S0 · 기본 협동','기존 발판·문·출구 흐름','실제 문 개방 후 출구 도달'],
 ['S1 · 목표 변경','유지 중 사람이 다른 목표를 요청','취소된 행동의 재실행 0건'],
 ['S2 · 전제 붕괴','동료가 발판을 벗어나 문이 닫힘','변화 이후 유효한 행동으로 복구'],
 ['S3 · 역할·순서','두 행동의 동시 점유 / 선행 조건 추가','충돌·중복·순서 위반 기록'],
 ['S4 · 지시 모호성','“저쪽 발판”처럼 후보가 둘인 지시','확인 질문 후 의도한 대상 수행']])+'''<p class="small">S0는 현재 검증 경로를 재사용한다. S1–S4는 반복 실험용 시나리오·판정기를 보완하는 제안이다.</p>''',
 '실행 기능이 일부 있어도 실험 시나리오가 완료된 것은 아니다. 먼저 현재 발판 흐름에서 S1·S2를 구현하고, S3의 자원/순서 규칙과 S4의 질문은 추가 예산으로 진행한다. 동일 시드에서 변화 발생 시점과 파트너 스크립트를 재현한다. 취소 0건 기준은 안전 관련 목표이지 측정 성과가 아니다. 복구 성공은 정해진 제한 시간 내 유효 행동과 최종 목표를 별도로 판정한다. 최종 상태만 같아도 잘못된 중간 행동을 기록한다.',eyebrow='벤치마크 초안 · 작은 범위에서 깊게',source=cite('partnr','adapt','coco'))

slide('LoRA: 형식보다<br>상황에 맞는 행동 선택을 학습',f'''<div class="evidence-layout lora-layout">{fig('lora','LoRA의 동결된 사전학습 가중치와 추가 학습 행렬 A·B')}<div>{rows([('기법','기존 모델 가중치를 고정하고<br>작은 저랭크 행렬을 학습한다.'),('가설 H2','같은 Qwen의 학습 전후를 비교해<br>잘못된 선택·중복 행동이 줄어드는지 본다.'),('학습 과제','관측 + 지시 + 실행 피드백 →<br>행동 / 대기 / 확인 질문 선택')])}<p class="guard-note">JSON 형식 통과와 의미상 올바른 선택은 별도 지표</p></div></div>''',
 'Hu 등, ICLR 2022; 화면 그림은 접근 가능한 arXiv v2 PDF Figure 1이다. LoRA 자체가 새 기여가 아니라 통제한 협동 과제에서 무엇이 개선되는지가 기여다. 정답 라벨과 허용 가능한 복수 행동을 검토한다. 형식 검증으로 이미 잡히는 오류와 학습이 줄이는 의미 오류를 구분한다. 장황한 자유 추론문을 정답으로 쌓기보다 공개 관측에 근거한 행동과 짧은 근거를 기록한다. 새로운 기억 저장소나 세 번째 AI를 추가하는 계획이 아니다.',eyebrow='R6 · 행동 모델 적응')

slide('QLoRA는 학습 메모리의 선택지.<br>실행 속도는 따로 측정한다.',f'''<div class="evidence-layout">{fig('qlora','전체 파인튜닝·LoRA·QLoRA의 모델과 학습 메모리 구성 비교')}<div>{rows([('원 논문의 초점','양자화된 기본 모델 위에<br>어댑터를 학습해 메모리를 절약한다.'),('우리 장비의 첫 관문','현재 모델 계열을 확인한 뒤<br>짧은 학습으로 VRAM·시간·변환을 점검한다.'),('추론 조건 통제','같은 정밀도·컨텍스트·디코딩 조건에서<br>기본 모델과 학습 모델을 평가한다.')])}</div></div>''',
 'Dettmers 등, NeurIPS 2023. 학습 메모리 절감과 플레이 응답 지연 개선은 다른 주장이다. 10월 4일 직접 확인한 RTX 5070 Ti 16GB에서도 Qwen 4B 학습이 된다고 아직 단정하지 않는다. LM Studio의 qwen/qwen3-4b-2507 별칭을 공식 Qwen3-4B-Instruct-2507 원본 가중치·tokenizer·chat template·정밀도와 대조한다. GGUF 추론 파일 자체를 일반 학습 원본으로 간주하지 않는다. 어댑터 병합 또는 변환 후 같은 서버 경로로 실행되는지 확인한다. 4B가 불가능하면 작은 동일 계열로 양쪽 조건을 함께 바꾸고 변경을 기록한다.',eyebrow='R7 · 학습 환경과 속도의 구분',source=cite('qwen'))

slide('학습 데이터보다 먼저<br>평가 데이터의 경계를 고정', '''<div class="data-flow"><div><span>01</span><h3>과제군부터 분리</h3><p>맵·관계 조합·전체 실행 기록 단위로 train / validation / test 분리</p></div><div><span>02</span><h3>실패를 라벨링</h3><p>옛 목표 지속, 중복 행동, 잘못된 대상, 필요한 질문의 누락</p></div><div><span>03</span><h3>그다음 학습</h3><p>기본 모델과 같은 출력 규격.<br>추가로 선택할 행동만 학습</p></div></div><p class="takeaway">같은 장면의 문장만 바꾼 데이터를 학습·평가에 나누면,<br>미지의 협동 상황에 대한 성능을 평가할 수 없다.</p><p class="small">평가 세트는 잠근다. 프롬프트·주기·트리거·학습 설정은 validation에서만 고른다.</p>''',
 '가설은 학습이 새로운 맵/관계/시드에서 의미 오류를 줄이는지다. 먼저 기본 모델의 실패를 수집하고 정답 검토 기준을 합의한다. 전부 어려운 실패만 학습하면 정상 행동을 잊을 수 있어 정상 사례·대기·질문 사례를 섞는다. 공개되지 않은 현재 상태를 라벨 설명에 넣어 정답을 누설하지 않는다. 문장 변형은 분리 후 수행한다. 데이터가 작으면 검증 불확실성을 보고하고 과제별 분석을 남긴다. 이 분할과 라벨 설계는 우리 제안이며 원 논문의 실험 재현이라고 부르지 않는다.',eyebrow='데이터 설계 · 제안',source=cite('lora','qwen'))

slide('네 조건으로 효과를 분리한다', '''<div class="factorial"><div class="factorial-grid"><div class="axis">호출 정책 / 행동 모델</div><div class="axis">기본 모델</div><div class="axis">같은 모델 + LoRA</div><div class="axis">고정 주기</div><div class="condition" data-condition="A"><strong>A</strong><p>주기 · 기본</p></div><div class="condition" data-condition="C"><strong>C</strong><p>주기 · 학습</p></div><div class="axis">사건 + 최대 대기</div><div class="condition" data-condition="B"><strong>B</strong><p>사건 · 기본</p></div><div class="condition" data-condition="D"><strong>D</strong><p>사건 · 학습</p></div></div><div class="factorial-caption"><p data-contrast-text>호출 효과: B−A, D−C를 비교한다.</p><div class="interactive-controls"><button type="button" data-contrast="policy" aria-pressed="true">호출 효과</button><button type="button" data-contrast="training" aria-pressed="false">학습 효과</button><button type="button" data-contrast="interaction" aria-pressed="false">상호작용</button></div></div></div><p class="small">동일 정보·시드·파트너·보호 장치·추론 정밀도·제한 시간. 고정 주기는 여러 후보를 검증한다.</p>''',
 '호출 효과는 B−A와 D−C, 학습 효과는 C−A와 D−B, 상호작용은 (D−C)−(B−A)다. 방향은 성공률처럼 클수록 좋은 지표를 설명하는 예이며 시간/비용은 작을수록 좋은 것으로 보고한다. 비교를 공정하게 하려면 같은 총 시간·토큰/호출 상한을 부여하고 실제 사용량을 함께 기록한다. 고정 주기 하나를 임의로 느리게 선택하지 않고 빠름/중간/느림 후보를 validation에서 고정한다. 타이머와 사건 처리를 모두 쓰는 구현이면 하이브리드 정책으로 명명한다. 정보 조건과 질문 정책은 우선 고정하고 보조 실험에서만 바꾼다.',eyebrow='주 실험 · 기존 확정 방향의 구체화',cls='factorial-slide')

slide('성공률·지연·비용을<br>같은 실행 기록에서 함께 읽는다',table(['지표','측정 정의','주의할 함정'],[
 ['과제 성공','실제 목표 조건 충족 / 전체 시도','타임아웃·복구 실패를 분모에서 빼지 않기'],
 ['변화 대응 지연','변화 발생 → 첫 유효 행동의 실행 시작','p50 / p95 + 제한 시간 내 무반응 비율'],
 ['모델 의미 오류','잘못된 대상·순서·옛 목표 선택','형식 오류·실행 차단 건수와 구분'],
 ['계산·협동 비용','호출·토큰·벽시계 시간·파트너 대기','성공한 실행만 골라 계산하지 않기']])+'''<p class="takeaway">같은 장면·시드의 짝 비교 + 변동 범위 + 대표 실패 기록</p>''',
 '시범 실행은 조건당 5–10개 시드로 분산·시간을 확인하는 제안이다. 최종 반복 수는 측정 비용과 원하는 정밀도를 보고 정하며 작은 표본으로 확정적 우월성을 주장하지 않는다. 시드/장면 단위 짝 차이와 bootstrap 신뢰구간을 사용할 수 있다. 인간 파트너 실험은 순서 효과를 섞고 연습을 맞추되 소규모면 탐색적 결과로 둔다. 이벤트 누락 지표를 별도로 두고 검출 지연과 추론·실행 지연을 나눈다. guard에 막힌 잘못된 제안과 실제 잘못 실행된 행동을 분리해 보호 장치 성능이 모델 지능을 가리지 않게 한다. 이 측정 정의는 팀의 설계안이다.',eyebrow='검증 계획 · 성능 수치 미측정')

slide('Collab-Overcooked:<br>협동을 먼저 제안하는 능력도 평가',f'''<div class="evidence-layout">{fig('collab','협동을 먼저 요청하는 과정과 요청에 응답하는 과정을 구분한 Collab-Overcooked 그림')}<div>{rows([('논문의 구분','협동을 시작하는 행동과<br>받은 요청에 응답하는 행동을 나눈다.'),('우리의 응용','“잘 따라왔나”뿐 아니라<br>필요할 때 역할 분담을 제안했는지 기록한다.'),('작게 적용할 지표','유효한 도움 요청, 중복 요청,<br>요청 후 실제 작업 진전')])}</div></div>''',
 'Sun 등, EMNLP 2025. 논문은 trajectory efficiency와 incremental efficiency를 이용해 IC/RC 등을 정의한다. 우리는 우선 게임 상태에서 도움 요청이 다음 조건 충족에 기여했는지 판정한다. 원 논문 지표를 정확히 구현하지 않으면 동일한 IC/RC 수치라고 명명하지 않는다. 도움 요청을 많이 한 것이 좋은 협동은 아니다. 사람에게 질문만 떠넘기는 사례와 필요한 협력 요청을 구분한다.',eyebrow='R4 · 과정 평가')

slide('CoCoBench: 성공한 실행 안에도<br>비효율적인 협동이 숨어 있다',f'''<div class="evidence-layout">{fig('coco','CoCoBench의 작업 분담·순서·상호 배제·인계 네 가지 협동 상황')}<div>{rows([('네 가지 진단 축','작업 분담 · 순서 준수<br>공유 자원 충돌 · 인계 조율'),('우리에게 유용한 이유','둘 다 같은 발판을 택하거나<br>상대가 기다리는 이유를 구분할 수 있다.'),('근거의 수준','2026.08 공개 사전 논문.<br>지표 아이디어로 참고하고 검증 수준을 구분한다.')])}</div></div>''',
 'Chen 등, CoCoBench arXiv:2608.28266v1, 2026-08-28. 2026-10-08 확인 기준 preprint이며 심사 완료 논문으로 표시하지 않는다. 네 구성은 task allocation, sequential ordering, mutual exclusion, handoff coordination이다. 논문의 구성 점수는 관측 가능한 해당 행동이 충분한 궤적에서 정의되므로 높은 점수가 목표 성공을 뜻하지 않는다. 우리 로그에도 충돌/중복/대기/인계 사건을 넣되 게임 특성에 맞춘 판정 규칙을 공개한다. 새로운 물체 운반 시스템까지 반드시 만들 필요는 없다.',eyebrow='R10 · 보조 진단, 사전 공개 연구')

slide('KnowNo: 모호할 때 질문하는 정책은<br>작지만 설득력 있는 확장',f'''<div class="evidence-layout">{fig('knowno','KnowNo가 여러 가능한 행동 중 불확실할 때 사람에게 확인하는 장면')}<div>{rows([('원 논문의 방법','보정된 예측 집합으로<br>행동을 정할지 도움을 요청할지 선택한다.'),('우리의 첫 실험','항상 실행 / 항상 질문 / 선택적 질문의<br>성공·추가 질문 수·완료 시간을 비교한다.'),('보장과 휴리스틱 구분','자기보고 confidence만으로<br>논문의 통계적 보장을 주장할 수 없다.')])}</div></div>''',
 'Ren 등, CoRL 2023. Conformal prediction은 calibration/test 가정 아래 커버리지 보장을 구성하며 후보 점수와 별도 calibration set이 필요하다. 현재 로컬 API에서 점수 접근과 후보 생성 품질이 확보되는지 먼저 확인해야 한다. 후보가 하나가 아닌 경우 도움을 요청하는 원리만 단순화하면 휴리스틱 질문 정책이라고 명시한다. 사용자 도움의 정확성과 환경 분포 변화도 보장에 영향을 준다. 이 실험은 핵심 2×2가 안정된 뒤의 보조 범위다.',eyebrow='R5 · 선택 과제, 확인 질문')

slide('TEACh: 대화와 행동 연결을<br>가상 작업 훈련으로 확장할 수 있다',f'''<div class="evidence-layout">{fig('teach','TEACh의 서로 다른 정보와 시점을 가진 Commander·Follower가 대화하는 화면')}<div>{rows([('문헌에서 확인한 범위','가정 내 과제에서 서로 다른 정보를<br>가진 두 역할이 대화하며 행동한다.'),('우리의 응용 제안','“전원 차단 → 부품 이동 → 점검”처럼<br>절차와 역할이 있는 가상 과제 1개.'),('주장의 경계','절차 수행 시연은 가능성의 근거.<br>교육 효과나 실물 안전성은 별도 검증 대상.')])}</div></div>''',
 'Padmakumar 등, AAAI 2022, TEACh 프로젝트와 arXiv:2110.00534 PDF Figure 2. TEACh는 가정 내 작업의 인간 간 대화 및 실행 데이터이며 산업 훈련 효과를 검증한 논문은 아니다. 가상 절차 훈련은 우리가 도출한 응용 제안이다. 기존 발판/문 상태를 스위치/안전 인터록 같은 논리 조건으로 대응시키고, 새 고품질 산업 자산이나 실제 장치를 만들지 않는 작은 시연을 권한다. 숨겨진 작업 답안을 모델에 제공하는 경우 정보 비대칭과 평가 범위를 명시한다.',eyebrow='R8 · 응용의 근거와 한계')

slide('응용 후보는 “새로 필요한 것”으로 비교',table(['응용','재사용할 기반','추가 부담 / 이번 학기 판단'],[
 ['가상 절차 훈련','대화 지시·순서 조건·실행 피드백','절차 1개·판정 규칙 → 가장 권고'],
 ['협동 NPC 도움 기능','기존 퍼즐·취소·질문·역할 분담','질문 정책·작은 사용성 시험 → 가까운 확장'],
 ['가정 내 보조 시뮬레이션','부분 정보·대화·협동 평가','물체 조작·탐색이 새로 필요 → 후속'],
 ['실물 로봇 보조','의사결정 인터페이스·로그 설계','센서·조작·장치 안전 검증 → 이번 범위 밖']])+'''<p class="takeaway">응용 시연은 기존 연구를 설명하는 하나의 추가 장면으로.<br>새 플랫폼 개발이 핵심 비교 실험을 밀어내지 않게 한다.</p>''',
 '이 표는 문헌과 현재 팀 구현을 대조한 판단이다. 비용·구현 기간 실측이나 팀 합의로 제시하지 않는다. 가상 훈련의 교육적 가치, 협동 NPC의 만족도, 가정 보조의 일반화는 각각 별도의 사용자/환경 연구가 있어야 주장할 수 있다. 현재 타깃은 구조화된 상태가 있는 작은 협동 과제다.',eyebrow='응용 분석 · 제안',source=cite('teach','partnr','knowno'))

slide('사용자 경험도 연구와 연결할 수 있다', '''<p class="lead">AI가 언제 듣고, 무엇을 실행하며, 어떻게 멈추는지 보이게 한다.</p>'''+table(['설계 원칙의 적용','실제 플레이에서 확인할 것','기록할 근거'],[
 ['현재 상태 표시','듣는 중 / 판단 중 / 실행 중 / 확인 필요','사용자가 상태를 맞게 이해했는가'],
 ['쉬운 취소와 수정','“멈춰”, “왼쪽 말고 오른쪽”','취소 지연·잘못된 재시작·수정 성공'],
 ['불확실할 때 범위 축소','후보가 여럿이면 짧은 확인 질문','질문 부담과 오동작의 균형']])+'''<p class="small">소규모 사용성 관찰은 탐색적 근거로 보고한다. 만족도만으로 행동 모델 성능을 대체하지 않는다.</p>''',
 'Amershi 등, CHI 2019 Guidelines for Human-AI Interaction. 동작/능력의 명확화, 효율적인 취소·수정, 불확실할 때 범위 축소 원칙을 프로젝트에 적용한 제안이다. 원 논문의 표 18개 전체를 복제하지 않고 세 주제를 재서술했다. 사람 마이크·스피커 시험은 기능 검증, 사용자 경험 평가는 별도 질문과 관찰 기준으로 구분한다. 일반화 가능한 사람 연구로 확대할 경우 학교의 연구 참여 및 데이터 취급 절차를 확인해야 하지만 이번 자료는 소규모 내부 시연 계획이다.',eyebrow='R9 · 공학 외 응용, HCI',source=cite('hai'))

slide('약 8주를 가정한 실행 순서',table(['기간','완료할 작업','다음 단계로 넘어갈 근거'],[
 ['W1 · 지금','최신 Live·사람 플레이, 구간 계측','입력부터 실제 실행까지 같은 기록으로 추적'],
 ['W2','S0–S2 반복 실행·판정, 데이터 분리','시드·변화 주입·기준 성공 판정 재현'],
 ['W3–4','주기/사건 정책 비교 + LoRA 시범 학습','호출 조건 동등성, 학습→추론 왕복 확인'],
 ['W5–6','잠근 평가 세트로 네 조건 비교','성공·지연·비용과 대표 실패 근거 확보'],
 ['W7','보조 실험 또는 응용 1개, 결과 정리','핵심 실험 완료 시에만 확장'],
 ['W8','시연 안정화·보고서·재현 자료','버전·데이터·설정·영상·한계가 함께 남음']]),
 '남은 기간을 약 8주로 잡은 상대 일정이며 공식 종강/최종 발표일은 확인되지 않았다. 10월 9일 진행 과정 이메일 제출 안내와 10월 16일 1차 멘토링 완료 기한은 기존 학기 기록에서 별도로 관리한다. 이 자료를 배포했다고 교수님·멘토에게 전달 또는 제출 완료한 것이 아니다. W1의 최신 Live 및 사람 시험을 먼저 끝내고, 이후 비교 실험의 조건을 동결한다. 일정이 줄면 보조 질문/정보 실험과 응용 장면을 먼저 축소한다.',eyebrow='일정 제안 · 실제 마감에 맞춰 조정')

slide('첫 주에는 역할별 결과물을<br>하나의 실행 기록으로 합친다',table(['기존 담당','우선 작업 제안','완료 기준'],[
 ['영호 · 조정기·대화','이벤트/요청/취소/모델/실행 타임라인','같은 trial_id로 변화부터 결과까지 연결'],
 ['경민 · 게임·상태 필터','상태 변화 주입·초기화·실제 성공 판정','같은 시드로 같은 실패 장면 재현'],
 ['준영 · 행동 AI·실행기','기본 모델 고정·학습/변환 시범 실행','모델·프롬프트·정밀도·설정 기록']])+'''<div class="gates"><p><strong>학습 관문</strong> W4까지 학습→동일 실행 경로가 안 되면 모델/학습 범위를 재협의</p><p><strong>범위 관문</strong> 반복 판정이 불안정하면 응용보다 시나리오를 줄여 재현성 확보</p></div>''',
 '역할은 9월 19일 사용자 확정 범위를 따른다. 이 표의 세부 작업 배정은 이번 조사에서 제안한 것으로 팀 합의가 아니다. 친구 코드의 큰 변경을 전제로 하지 않고 관측·리셋·이벤트/모델 어댑터 경계를 재사용한다. 학습에 성과가 없더라도 형식/의미/시나리오별 오류와 자원 제한을 분석해 보고할 수 있다. 학습을 몰래 생략하거나 비교군 모델만 바꾸지 않는다. GPU나 프레임워크 이슈가 나타나면 검증 가능 범위를 근거로 일정·주장을 조정한다.',eyebrow='역할 유지 · 세부 과제 제안')

slide('최종 결과물은<br>“된다”를 넘어 “어떤 조건에서 왜”', '''<div class="deliverable-list"><div><b>01</b><p>사람과 끝까지 플레이할 수 있는<br><strong>안정적인 협동 시연</strong></p></div><div><b>02</b><p>같은 장면으로 다시 실행 가능한<br><strong>작은 벤치마크와 이벤트 로그</strong></p></div><div><b>03</b><p>재판단 × 학습의 효과와 한계를 보여 주는<br><strong>비교표·변동 범위·실패 사례</strong></p></div><div><b>04</b><p>가상 절차 훈련 또는 NPC 도움 기능의<br><strong>응용 장면 하나</strong></p></div></div><p class="takeaway">추천하는 다음 행동: S0–S2 판정과 계측부터 고정한다.</p>''',
 '새 기법을 발명했다는 과장보다 정보 조건과 실험 환경을 명확히 한 재현 가능한 비교가 현재 팀의 현실적인 공학 기여다. 결과가 없는데 그래프를 채우지 않고, 실패도 시나리오/원인/재현 로그로 보고한다. 이 제안은 문헌을 근거로 한 작업 방향이며 구현·학습·사용자 성능 검증을 완료했다는 뜻이 아니다. 팀에서 먼저 동의할 항목은 핵심 시나리오, 정보 조건, 자원/시간 예산, 결과 판정 기준이다.',eyebrow='권고 결론 · 효과와 한계를 설명하는 프로젝트')

def ref_list(keys):
    return '<div class="reference-list">'+''.join(f'''<div><span>{by[k]['id']}</span><p><a href="{by[k]['url']}" target="_blank" rel="noopener">{html.escape(by[k]['title'])}</a><small>{by[k]['authors']} · {by[k]['venue']}{' · 캡처: arXiv v2' if k=='lora' else ''}{' · 사전 공개, 심사 완료로 간주하지 않음' if k=='coco' else ''}</small></p></div>''' for k in keys)+'</div>'
slide('참고문헌 1/2 · 구조·과제·학습',ref_list(['dpt','partnr','adapt','collab','knowno','lora']),
 '모든 링크는 원 논문/공식 프로젝트/공식 저자 페이지로 연결된다. 확인일 2026-10-08. R1·R3·R4 ACL Anthology, R2 ICLR proceedings 및 공식 프로젝트, R5 PMLR, R6 OpenReview와 arXiv v2를 확인했다. R6 OpenReview 원문 PDF 접근이 제한되어 공개 arXiv v2에서 그림을 캡처했다. 정확한 PDF 주소·페이지·crop 좌표·SHA-256은 source/capture-manifest.json에 기록했다.',eyebrow='1차 출처 · 확인일 2026.10.08',cls='reference-slide')
slide('참고문헌 2/2 · 응용·실행 조건',ref_list(['qlora','teach','hai','coco','qwen'])+'''<p class="source-method">원문 PDF의 그림 9개를 직접 캡처했다.<br>수치 재현·성능 이전을 주장하지 않으며, 우리 적용안은 제안으로 구분한다.</p>''',
 'R7 NeurIPS proceedings, R8 저자 프로젝트 및 arXiv, R9 Microsoft Research 저자 페이지와 camera-ready PDF, R10 arXiv v1, R11 Qwen 공식 모델 카드를 확인했다. 수동 도식 복제나 생성형 이미지로 논문 캡처를 대체하지 않았다. 원문 PDF와 캡처 해시는 로컬 학기 자료에 보관한다. 공개 슬라이드에는 필요한 그림 발췌와 출처만 포함한다. 본 자료의 출처 조사, 논문 해석과 제안, 웹/PDF 검수 및 배포 확인은 날짜별 학기 기록에서 연결한다.',eyebrow='1차 출처 · 확인일 2026.10.08',cls='reference-slide')

document='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="교수님 피드백과 11개 1차 출처를 바탕으로 정리한 협동 게임 AI의 남은 반학기 연구·평가·응용 계획. 논문 그림 9개와 26장 발표자료."><title>협동 게임 AI의 남은 반학기 연구와 응용</title><link rel="icon" href="../shared/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="../shared/deck.css"><link rel="stylesheet" href="../shared/themes/light.css"><link rel="stylesheet" href="styles.css"><script src="../shared/deck.js" defer></script><script src="deck.js" defer></script></head><body><a class="deck-download" href="downloads/CoopAINext.pdf" download>PDF 다운로드 ↓</a><main class="deck-shell"><div class="deck-stage" data-deck data-deck-title="협동 게임 AI의 남은 반학기 연구와 응용" data-deck-footer="1팀 더미 · 연구와 응용 계획 · 2026.10.08">'''+''.join(slides)+'''</div></main><nav class="deck-controls" aria-label="슬라이드 이동"><button type="button" data-deck-previous title="이전 슬라이드 (←)">←</button><span class="deck-count" data-deck-count aria-live="polite"></span><button type="button" data-deck-next title="다음 슬라이드 (→)">→</button></nav><div class="deck-progress-track" aria-hidden="true"><div class="deck-progress" data-deck-progress></div></div><aside class="notes-panel" data-deck-notes aria-label="발표자 노트"></aside><dialog class="figure-dialog" aria-label="논문 원문 그림 확대"><button type="button" data-close-figure>닫기 ×</button><img src="assets/references/dpt.png" alt=""><p></p></dialog></body></html>'''
(out/'index.html').write_text(document,encoding='utf8')
(out/'source'/'references.json').write_text(json.dumps(refs,ensure_ascii=False,indent=2),encoding='utf8')
(out/'source'/'slides.json').write_text(json.dumps([{'number':i+1,'html':s} for i,s in enumerate(slides)],ensure_ascii=False,indent=2),encoding='utf8')
plain=lambda value: html.unescape(re.sub(r'<[^>]+>', ' ', value)).strip()
notes=['# 장별 발표 노트', '', '본문 24장 + 참고문헌 2장. 그림 확대, 방향키 이동, N 발표자 노트.', '']
for i,s in enumerate(slides):
    notes += [f'## {i+1}. '+plain(re.search(r'<h2>(.*?)</h2>',s).group(1)), '', plain(re.search(r'<aside class="speaker-notes">(.*?)</aside>',s).group(1)), '']
(out/'source'/'speaker-notes.md').write_text('\n'.join(notes),encoding='utf8')
if Path(__file__).resolve() != (out/'source'/'author.py').resolve():
    shutil.copyfile(__file__,out/'source'/'author.py')
print(f'Authored {len(slides)} slides')
