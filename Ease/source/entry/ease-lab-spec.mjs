// 이징 함수 수업용 엔트리 작품
// MYentry-game의 tools/make-ent.mjs에서 바로 읽을 수 있는 독립형 spec입니다.

const num = (value) => ({ type: 'number', params: [String(value)] });
const text = (value) => ({ type: 'text', params: [String(value)] });
const getVar = (id) => ({ type: 'get_variable', params: [id, null] });
const setVar = (id, value) => ({ type: 'set_variable', params: [id, value, null] });
const changeVar = (id, value) => ({ type: 'change_variable', params: [id, value, null] });
const calc = (left, operator, right) => ({
    type: 'calc_basic',
    params: [left, { '+': 'PLUS', '-': 'MINUS', '*': 'MULTI', '/': 'DIVIDE' }[operator], right],
});
const cmp = (left, operator, right) => ({
    type: 'boolean_basic_operator',
    params: [left, { '<': 'LESS', '>': 'GREATER', '==': 'EQUAL' }[operator], right],
});
const whenRun = () => ({ type: 'when_run_button_click', params: [null] });
const whenMessage = (id) => ({ type: 'when_message_cast', params: [null, id] });
const repeat = (count, body) => ({
    type: 'repeat_basic',
    params: [count, null],
    statements: [body],
});
const ifElse = (condition, yes, no) => ({
    type: 'if_else',
    params: [condition, null, null],
    statements: [yes, no],
});
const wait = (seconds) => ({ type: 'wait_second', params: [seconds, null] });
const locateX = (x) => ({ type: 'locate_x', params: [x, null] });
const locateXY = (x, y) => ({ type: 'locate_xy', params: [x, y, null] });
const sendMessageWait = (id) => ({ type: 'message_cast_wait', params: [id, null] });
const writeText = (value) => ({ type: 'text_write', params: [value, null] });
const combine = (left, right) => ({
    type: 'combine_something',
    params: [null, left, null, right, null],
});

const START_X = -120;
const END_X = 230;

const boardSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" rx="0" fill="#10182B"/>
  <g stroke="#263554" stroke-width="1" opacity="0.55">
    <path d="M0 60H640M0 120H640M0 180H640M0 240H640M0 300H640"/>
    <path d="M80 0V360M160 0V360M240 0V360M320 0V360M400 0V360M480 0V360M560 0V360"/>
  </g>
  <g stroke="#6C7FA8" stroke-width="3" stroke-linecap="round" opacity="0.8">
    <path d="M200 90H550M200 150H550M200 210H550M200 270H550"/>
  </g>
  <g fill="#22B6FF">
    <circle cx="200" cy="90" r="5"/><circle cx="200" cy="150" r="5"/>
    <circle cx="200" cy="210" r="5"/><circle cx="200" cy="270" r="5"/>
  </g>
  <g fill="#8B0029">
    <circle cx="550" cy="90" r="6"/><circle cx="550" cy="150" r="6"/>
    <circle cx="550" cy="210" r="6"/><circle cx="550" cy="270" r="6"/>
  </g>
</svg>`;

function ballSvg(fill) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="26" r="18" fill="#050A16" opacity="0.35"/>
      <circle cx="24" cy="22" r="18" fill="${fill}" stroke="#FFFFFF" stroke-width="3"/>
      <circle cx="18" cy="16" r="5" fill="#FFFFFF" opacity="0.62"/>
    </svg>`;
}

function sprite(id, name, svgString, entity, threads = [[]]) {
    return {
        id,
        name,
        objectType: 'sprite',
        pictures: [{
            id: `${id}_picture`,
            name,
            svgString,
            imageType: 'svg',
            dimension: { width: entity.width, height: entity.height },
        }],
        selectedPictureId: `${id}_picture`,
        entity: {
            regX: entity.width / 2,
            regY: entity.height / 2,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            direction: 90,
            visible: true,
            ...entity,
        },
        script: threads,
    };
}

function label(id, value, y, { x = -175, width = 130, fontSize = 17, align = 0 } = {}) {
    return {
        id,
        name: value,
        objectType: 'textBox',
        text: value,
        entity: {
            x,
            y,
            regX: 0,
            regY: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            direction: 90,
            width,
            height: 34,
            font: `${fontSize}px NanumGothic`,
            colour: '#F7FAFF',
            bgColor: 'transparent',
            lineBreak: false,
            textAlign: align,
            visible: true,
        },
        script: [[]],
    };
}

function positionFrom(progress) {
    return calc(num(START_X), '+', calc(num(END_X - START_X), '*', progress));
}

function easingBall({ id, name, y, color, progressVar, progressExpression, branch }) {
    const formulaBlocks = branch || [setVar(progressVar, progressExpression)];
    return sprite(id, name, ballSvg(color), {
        x: START_X,
        y,
        width: 48,
        height: 48,
    }, [
        [whenRun(), locateXY(num(START_X), num(y))],
        [
            whenMessage('tick'),
            ...formulaBlocks,
            locateX(positionFrom(getVar(progressVar))),
        ],
    ]);
}

const oneMinusT = calc(num(1), '-', getVar('time_ratio'));

export default {
    name: '이징 함수 실험실',
    messages: [{ id: 'tick', name: '위치 계산' }],
    variables: [
        { id: 'start_x', name: '시작 x', value: String(START_X), visible: false },
        { id: 'end_x', name: '끝 x', value: String(END_X), visible: false },
        { id: 'duration', name: '전체 시간', value: '2', visible: false },
        { id: 'steps', name: '반복 횟수', value: '40', visible: false },
        { id: 'step', name: '단계', value: '0', visible: false },
        { id: 'time_ratio', name: '시간 비율 t', value: '0', visible: false },
        { id: 'p_linear', name: '일정하게 p', value: '0', visible: false },
        { id: 'p_in', name: '천천히 출발 p', value: '0', visible: false },
        { id: 'p_out', name: '천천히 도착 p', value: '0', visible: false },
        { id: 'p_inout', name: '양쪽 천천히 p', value: '0', visible: false },
        { id: 'done', name: '완료', value: '0', visible: false },
    ],
    objects: [
        label('title', '같은 2초, 다른 움직임', 108, { x: -100, width: 320, fontSize: 23 }),
        label('label_linear', '일정하게', 90),
        label('label_in', '천천히 출발', 30),
        label('label_out', '천천히 도착', -30),
        label('label_inout', '양쪽 천천히', -90),

        {
            ...label('clock', '시간 비율 t = 0', 108, { x: 182, width: 128, fontSize: 15, align: 2 }),
            script: [[
                whenMessage('tick'),
                writeText(combine(text('시간 비율 t = '), getVar('time_ratio'))),
            ]],
        },

        easingBall({
            id: 'linear_ball',
            name: '일정하게 공',
            y: 90,
            color: '#22B6FF',
            progressVar: 'p_linear',
            progressExpression: getVar('time_ratio'),
        }),
        easingBall({
            id: 'ease_in_ball',
            name: '천천히 출발 공',
            y: 30,
            color: '#F72585',
            progressVar: 'p_in',
            progressExpression: calc(getVar('time_ratio'), '*', getVar('time_ratio')),
        }),
        easingBall({
            id: 'ease_out_ball',
            name: '천천히 도착 공',
            y: -30,
            color: '#FFD166',
            progressVar: 'p_out',
            progressExpression: calc(num(1), '-', calc(oneMinusT, '*', oneMinusT)),
        }),
        easingBall({
            id: 'ease_inout_ball',
            name: '양쪽 천천히 공',
            y: -90,
            color: '#72EFDD',
            progressVar: 'p_inout',
            branch: [
                ifElse(
                    cmp(getVar('time_ratio'), '<', num(0.5)),
                    [setVar('p_inout', calc(num(2), '*', calc(getVar('time_ratio'), '*', getVar('time_ratio'))))],
                    [setVar('p_inout', calc(num(1), '-', calc(num(2), '*', calc(oneMinusT, '*', oneMinusT))))],
                ),
            ],
        }),

        {
            ...label('controller', '움직임 제어', -145, { x: -230, width: 130, fontSize: 14 }),
            entity: {
                ...label('controller_entity', '', 0).entity,
                x: -230,
                y: -145,
                width: 130,
                height: 24,
                font: '14px NanumGothic',
                colour: '#9FB2D8',
                visible: true,
            },
            script: [[
                whenRun(),
                setVar('done', num(0)),
                setVar('step', num(0)),
                setVar('time_ratio', num(0)),
                sendMessageWait('tick'),
                repeat(getVar('steps'), [
                    wait(calc(getVar('duration'), '/', getVar('steps'))),
                    changeVar('step', num(1)),
                    setVar('time_ratio', calc(getVar('step'), '/', getVar('steps'))),
                    sendMessageWait('tick'),
                ]),
                setVar('done', num(1)),
            ]],
        },

        // Entry는 배열 앞쪽 오브젝트를 위에 그리므로 배경은 마지막에 둡니다.
        sprite('board', '비교 트랙', boardSvg, {
            x: 0,
            y: 0,
            width: 640,
            height: 360,
        }),
    ],
    interface: {
        canvasWidth: 640,
        menuWidth: 280,
        object: 'controller',
    },
};
