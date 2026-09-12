// 중학교 1학년 이징 수업용 단계별 엔트리 작품
// 핵심 흐름: t 만들기 -> 좌표 범위 바꾸기 -> p와 이동 함수 분리 -> p 식만 교체하기

const num = (value) => ({ type: 'number', params: [String(value)] });
const getVar = (id) => ({ type: 'get_variable', params: [id, null] });
const setVar = (id, value) => ({ type: 'set_variable', params: [id, value, null] });
const changeVar = (id, value) => ({ type: 'change_variable', params: [id, value, null] });
const calc = (left, operator, right) => ({
    type: 'calc_basic',
    params: [left, { '+': 'PLUS', '-': 'MINUS', '*': 'MULTI' }[operator], right],
});
const compare = (left, operator, right) => ({
    type: 'boolean_basic_operator',
    params: [left, { '<': 'LESS' }[operator], right],
});
const whenRun = () => ({ type: 'when_run_button_click', params: [null] });
const repeat = (count, body) => ({
    type: 'repeat_basic',
    params: [count, null],
    statements: [body],
});
const locateX = (x) => ({ type: 'locate_x', params: [x, null] });
const ifElse = (condition, yes, no) => ({
    type: 'if_else',
    params: [condition, null, null],
    statements: [yes, no],
});
const stringParam = (id) => ({ type: `stringParam_${id}`, params: [] });
const callFunction = (id, ...args) => ({ type: `func_${id}`, params: args });

const START_X = -100;
const END_X = 100;

function ballSvg(fill = '#22B6FF') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="36" r="24" fill="#050A16" opacity="0.3"/>
      <circle cx="32" cy="30" r="24" fill="${fill}" stroke="#FFFFFF" stroke-width="4"/>
      <circle cx="24" cy="21" r="7" fill="#FFFFFF" opacity="0.62"/>
    </svg>`;
}

function trackSvg(start, end) {
    const toCanvas = (x) => x + 320;
    const startCanvas = toCanvas(start);
    const endCanvas = toCanvas(end);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#10182B"/>
      <g stroke="#263554" stroke-width="1" opacity="0.52">
        <path d="M0 60H640M0 120H640M0 180H640M0 240H640M0 300H640"/>
        <path d="M80 0V360M160 0V360M240 0V360M320 0V360M400 0V360M480 0V360M560 0V360"/>
      </g>
      <path d="M${startCanvas} 180H${endCanvas}" stroke="#6C7FA8" stroke-width="6" stroke-linecap="round"/>
      <circle cx="${startCanvas}" cy="180" r="9" fill="#22B6FF"/>
      <circle cx="${endCanvas}" cy="180" r="9" fill="#F72585"/>
      <g fill="#DCE7FA" font-family="NanumGothic, sans-serif" font-size="20" text-anchor="middle">
        <text x="${startCanvas}" y="225">${start}</text>
        <text x="${endCanvas}" y="225">${end}</text>
      </g>
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

function label(value) {
    return {
        id: 'lesson_title',
        name: value,
        objectType: 'textBox',
        text: value,
        entity: {
            x: -215,
            y: 100,
            regX: 0,
            regY: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            direction: 90,
            width: 430,
            height: 38,
            font: '23px NanumGothic',
            colour: '#F7FAFF',
            bgColor: 'transparent',
            lineBreak: false,
            textAlign: 1,
            visible: true,
        },
        script: [[]],
    };
}

function moveFunction() {
    const start = stringParam('strt');
    const end = stringParam('endx');
    return {
        id: 'move',
        type: 'normal',
        localVariables: [],
        useLocalVariables: false,
        content: [[{
            type: 'function_create',
            params: [{
                type: 'function_field_label',
                params: [
                    { __field: '이동하기' },
                    {
                        type: 'function_field_string',
                        params: [
                            stringParam('strt'),
                            {
                                type: 'function_field_label',
                                params: [
                                    { __field: '부터' },
                                    {
                                        type: 'function_field_string',
                                        params: [stringParam('endx'), null],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }, null],
            statements: [[
                locateX(calc(calc(getVar('p'), '*', calc(end, '-', start)), '+', start)),
            ]],
        }]],
    };
}

function commonObjects(title, startX, endX, script, color) {
    return [
        label(title),
        sprite('ball', '공', ballSvg(color), {
            x: startX,
            y: 0,
            width: 64,
            height: 64,
        }, [script]),
        // Entry는 배열 앞쪽 오브젝트를 위에 그리므로 배경은 마지막에 둡니다.
        sprite('track', '이동 길', trackSvg(startX, endX), {
            x: 0,
            y: 0,
            width: 640,
            height: 360,
        }),
    ];
}

function baseProject({ name, title, startX, endX, variables, script, functions = [], color }) {
    return {
        name,
        variables,
        functions,
        objects: commonObjects(title, startX, endX, script, color),
        interface: { canvasWidth: 640, menuWidth: 300, object: 'ball' },
        speed: 60,
    };
}

export function createStep1Project() {
    return baseProject({
        name: '이징 수업 1단계 - t로 0부터 100까지',
        title: '1단계  t × 100',
        startX: 0,
        endX: 100,
        variables: [{ id: 't', name: 't', value: 0, visible: true, x: 500, y: 15 }],
        script: [
            whenRun(),
            repeat(num(100), [
                changeVar('t', num(0.01)),
                locateX(calc(getVar('t'), '*', num(100))),
            ]),
        ],
        color: '#22B6FF',
    });
}

export function createStep2Project() {
    return baseProject({
        name: '이징 수업 2단계 - 좌표 범위 바꾸기',
        title: '2단계  t × 200 + (-100)',
        startX: START_X,
        endX: END_X,
        variables: [{ id: 't', name: 't', value: 0, visible: true, x: 500, y: 15 }],
        script: [
            whenRun(),
            repeat(num(100), [
                changeVar('t', num(0.01)),
                locateX(calc(calc(getVar('t'), '*', num(200)), '+', num(-100))),
            ]),
        ],
        color: '#FFD166',
    });
}

function easingExpression(kind) {
    const t = getVar('t');
    if (kind === 'easeIn') return calc(t, '*', t);
    if (kind === 'easeOut') {
        const remaining = calc(num(1), '-', t);
        return calc(num(1), '-', calc(remaining, '*', remaining));
    }
    return t;
}

function easingBlocks(kind) {
    if (kind !== 'easeInOut') return [setVar('p', easingExpression(kind))];
    const remaining = () => calc(num(1), '-', getVar('t'));
    return [
        ifElse(
            compare(getVar('t'), '<', num(0.5)),
            [setVar('p', calc(num(2), '*', calc(getVar('t'), '*', getVar('t'))))],
            [setVar('p', calc(num(1), '-', calc(num(2), '*', calc(remaining(), '*', remaining()))))],
        ),
    ];
}

export function createEasingProject(kind = 'linear') {
    const labels = {
        linear: { name: '일정하게', formula: 'p = t', color: '#22B6FF' },
        easeIn: { name: '천천히 출발', formula: 'p = t × t', color: '#F72585' },
        easeOut: { name: '천천히 도착', formula: 'p = 1 - (1-t) × (1-t)', color: '#FFD166' },
        easeInOut: { name: '양쪽 천천히', formula: '전반과 후반 조건문', color: '#72EFDD' },
    };
    const current = labels[kind] || labels.linear;
    return baseProject({
        name: `이징 수업 - ${current.name}`,
        title: `${current.name}  ${current.formula}`,
        startX: START_X,
        endX: END_X,
        variables: [
            { id: 't', name: 't', value: 0, visible: true, x: 500, y: 15 },
            { id: 'p', name: 'p', value: 0, visible: true, x: 500, y: 52 },
        ],
        functions: [moveFunction()],
        script: [
            whenRun(),
            repeat(num(100), [
                changeVar('t', num(0.01)),
                ...easingBlocks(kind),
                callFunction('move', num(START_X), num(END_X)),
            ]),
        ],
        color: current.color,
    });
}

export const lessonProjects = [
    { file: 'ease-step1_001.ent', kind: 'step1', spec: createStep1Project() },
    { file: 'ease-step2_001.ent', kind: 'step2', spec: createStep2Project() },
    { file: 'ease-linear_001.ent', kind: 'linear', spec: createEasingProject('linear') },
    { file: 'ease-in_001.ent', kind: 'easeIn', spec: createEasingProject('easeIn') },
    { file: 'ease-out_001.ent', kind: 'easeOut', spec: createEasingProject('easeOut') },
    { file: 'ease-in-out_001.ent', kind: 'easeInOut', spec: createEasingProject('easeInOut') },
];

// make-ent.mjs에서 단일 spec으로 열 때는 수업의 기본형(p=t)을 사용합니다.
export default createEasingProject('linear');
