#!/usr/bin/env python3
"""이 자료에 쓰는 글자만 남긴 웹 글꼴(EHF Sans)을 만듭니다.

Pretendard(SIL OFL 1.1)는 'Pretendard'를 예약 글꼴 이름으로 정해 두었으므로,
글자를 줄인 수정본은 이름을 EHF Sans로 바꿔 저장하고 OFL 전문을 함께 둡니다.

사용법 (자료 폴더 기준):
    python source/subset-fonts.py <Pretendard TTF 폴더>

폴더에는 Pretendard-Medium/Bold/ExtraBold.ttf 와 OFL_Pretendard.txt 가 있어야 합니다.
index.html·deck.js 문구를 바꾸면 다시 실행하세요. source/qa.mjs 가 화면 글자가 모두
글꼴에 들어 있는지 source/font-glyphs.json 으로 확인합니다.
"""
import json
import shutil
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

DECK = Path(__file__).resolve().parent.parent
FAMILY = 'EHF Sans'
WEIGHTS = {500: 'Medium', 700: 'Bold', 800: 'ExtraBold'}
# 문구에 없어도 숫자·기호를 고칠 때 바로 쓸 수 있도록 함께 넣는 글자
EXTRA = ''.join(chr(code) for code in range(0x20, 0x7F)) + '·—–…“”‘’→←↑↓↔↺‹›✓✗×−①②③④⑤⑥'


def deck_chars():
    text = ''.join((DECK / name).read_text(encoding='utf-8') for name in ('index.html', 'deck.js'))
    return sorted({char for char in text + EXTRA if char.isprintable()})


def rename(font, style):
    name = font['name']
    full = f'{FAMILY} {style}'
    values = {1: FAMILY, 2: 'Regular', 3: f'{full}; EntryHarnessFlow subset', 4: full,
              6: f'EHFSans-{style}', 16: FAMILY, 17: style}
    for record in list(name.names):
        if record.nameID in (1, 2, 3, 4, 6, 16, 17):
            name.removeNames(nameID=record.nameID)
    for name_id, value in values.items():
        name.setName(value, name_id, 3, 1, 0x409)
        name.setName(value, name_id, 1, 0, 0)
    # 남은 이름 기록(설명 등)에도 원래 이름이 글꼴 이름처럼 남지 않게 합니다. 저작권·라이선스(0, 13, 14)는 그대로 둡니다.
    for record in name.names:
        if record.nameID not in (0, 13, 14) and 'Pretendard' in record.toUnicode():
            record.string = record.toUnicode().replace('Pretendard', FAMILY)


def main(source):
    chars = deck_chars()
    output = DECK / 'assets' / 'fonts'
    output.mkdir(parents=True, exist_ok=True)
    covered = None
    report = []
    for weight, style in WEIGHTS.items():
        font = TTFont(source / f'Pretendard-{style}.ttf')
        version = font['name'].getDebugName(5)
        cmap = font.getBestCmap()
        have = [char for char in chars if ord(char) in cmap]
        covered = set(have) if covered is None else covered & set(have)
        options = subset.Options()
        options.flavor = 'woff'
        options.hinting = False
        options.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk', 'tnum']
        options.name_IDs = ['*']
        options.name_languages = ['*']
        options.notdef_outline = True
        subsetter = subset.Subsetter(options)
        subsetter.populate(unicodes=[ord(char) for char in have])
        subsetter.subset(font)
        rename(font, style)
        font.flavor = 'woff'
        target = output / f'ehf-sans-{weight}.woff'
        font.save(target)
        report.append({'weight': weight, 'file': target.name, 'bytes': target.stat().st_size})
    shutil.copyfile(source / 'OFL_Pretendard.txt', output / 'OFL.txt')
    missing = [char for char in chars if char not in covered]
    (DECK / 'source' / 'font-glyphs.json').write_text(json.dumps({
        'family': FAMILY,
        'source': f'Pretendard {version} (SIL OFL 1.1), 글자를 줄이고 이름을 바꾼 수정본',
        'files': report,
        'chars': ''.join(sorted(covered)),
        'missing': ''.join(missing),
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'chars': len(covered), 'missing': ''.join(missing), 'files': report}, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
