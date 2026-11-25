/** @OnlyCurrentDoc */ // 권한을 "이 스프레드시트만"으로 좁힌다
// 사용법: 시트 > 확장 프로그램 > Apps Script 에 붙여넣고
//   1) setupSheet 한 번 실행 → 명단·전체명단 탭과 칸, 발굴등록 탭의 '처리결과' 칸을 만든다 (이미 있으면 빠진 칸만 추가)
//   2) installTrigger 한 번 실행 → 매일 23시(23~24시 사이)에 organizeSheet 가 돈다. 바로 돌리려면 organizeSheet 실행
//
// 탭
//   발굴등록(→ 나중에 '등록'으로 이름 바꿔도 됨): A열 '양식 붙여넣기' 에 양식 한 줄씩.
//            헤더 끝의 '처리결과' 칸에 '완료 날짜' 또는 '오류: 사유'가 적힌다.
//            완료된 줄은 다시 처리하지 않고, 오류 줄은 고쳐 두면 다음 날 다시 처리된다. 다른 칸은 건드리지 않는다.
//   명단:     고유번호/지역/팀/이름 (인도자·교사 목록. jdb members 처럼 팀 대신 '구역' 헤더도 됨, 팀은 '1', '1-3', '사랑-2' 등)
//   전체명단: 한 사람당 한 줄로 누적되는 결과. 번호는 발 등록 순서대로 1, 2, 3 …
//
// 양식 (맨 앞 단계로 구분)
//   발/이름/연락처/생년/성별/인도자지역/인도자팀/인도자이름/도구          → 전체명단에 새로 등록
//   찾기/이름/전화번호(뒷4자리)/성별/생년/발굴유형/인도자이름/고유번호    → 이름+뒷4자리로 찾아 갱신 (고유번호 = 인도자 고유번호)
//   합/이름/인도자지역/인도자이름/교사지역/교사이름/신앙유형             → 이름+인도자이름으로 찾아 갱신
//   섭|복|예정|가능|확정/이름/인도자지역/인도자이름/교사지역/교사이름      → 이름+인도자이름으로 찾아 갱신
//   탈락/이름/연락처/인도자지역/인도자팀/인도자이름/탈락사유              → 이름+뒷4자리로 찾아 현재상태 '탈'
//   찾탈|합탈|복탈/이름/인도자지역/인도자이름/교사지역/교사이름/탈락사유  → 이름+인도자이름으로 찾아 갱신
// 인도자·교사는 jdb 와 같은 규칙으로 명단에서 고유번호를 찾는다:
//   지역+팀+이름 (팀은 '1-3' → '1' 처럼 앞부분으로 비교, 동명이인이면 세부 구역까지 같아야 함)
//   팀 칸이 없는 양식은 지역+이름, 동명이인이면 전체명단에 이미 있는 팀으로 구분
//   타지파·타부서·지교회는 팀 없이 지역+이름
//   명단에 없으면 그 줄은 오류로 남긴다 (고유번호는 새로 만들지 않는다)

const PASTE_TABS = ['등록', '발굴등록']; // 앞쪽 이름의 탭을 먼저 쓴다
const MEMBERS = '명단';
const ALL = '전체명단';
const CURRENT = '현재명단';
const SETTINGS_TAB = '개강설정';
const GOALS_TAB = '목표';
const TEACHERS_TAB = '교사';

const FORMS = {
    발: ['단계', '이름', '연락처', '생년', '성별', '인도자지역', '인도자팀', '인도자이름', '도구'],
    찾기: ['단계', '이름', '연락처', '성별', '생년', '발굴유형', '인도자이름', '인도자고유번호'],
    합: ['단계', '이름', '인도자지역', '인도자이름', '교사지역', '교사이름', '신앙유형'],
    교사단계: ['단계', '이름', '인도자지역', '인도자이름', '교사지역', '교사이름'],
    탈락: ['단계', '이름', '연락처', '인도자지역', '인도자팀', '인도자이름', '탈락사유'],
    교사탈락: ['단계', '이름', '인도자지역', '인도자이름', '교사지역', '교사이름', '탈락사유'],
};
// 단계 → 양식
const STAGE = {
    발: '발',
    찾기: '찾기',
    합: '합',
    섭: '교사단계',
    복: '교사단계',
    예정: '교사단계',
    가능: '교사단계',
    확정: '교사단계',
    탈락: '탈락',
    찾탈: '교사탈락',
    합탈: '교사탈락',
    복탈: '교사탈락',
};
const STATUS = { 찾기: '찾', 탈락: '탈' }; // 현재상태에 줄여 쓰는 단계
const DATE_COL = { 발: '발굴등록날짜', 찾기: '찾기날짜', 탈락: '발굴탈락날짜' }; // 나머지는 '<단계>날짜'
const FREE_TEAM_REGIONS = ['타지파', '타부서', '지교회'];
const ALL_COLS = [
    '번호',
    '현재상태',
    '이름',
    '연락처',
    '생년',
    '성별',
    '도구',
    '발굴유형',
    '인도자지역',
    '인도자팀',
    '인도자이름',
    '인도자고유번호',
    '교사지역',
    '교사팀',
    '교사이름',
    '교사고유번호',
    '신앙유형',
    '탈락사유',
    '발굴등록날짜',
    '찾기날짜',
    '합날짜',
    '섭날짜',
    '복날짜',
    '예정날짜',
    '가능날짜',
    '확정날짜',
    '발굴탈락날짜',
    '찾탈날짜',
    '합탈날짜',
    '복탈날짜',
];

function installTrigger() {
    ScriptApp.getProjectTriggers()
        .filter((t) => t.getHandlerFunction() === 'organizeSheet')
        .forEach((t) => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('organizeSheet').timeBased().everyDays(1).atHour(23).inTimezone('Asia/Seoul').create();
}

function setupSheet() {
    const ss = SpreadsheetApp.getActive();
    const tab = (name, cols) => {
        const sh = ss.getSheetByName(name) || ss.insertSheet(name);
        const have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(norm_) : [];
        const missing = cols.filter((c) => !have.includes(norm_(c)) && !(c === '팀' && have.includes('구역')));
        if (!missing.length) return;
        const start = have.length + 1;
        const need = start + missing.length - 1 - sh.getMaxColumns();
        if (need > 0) sh.insertColumnsAfter(sh.getMaxColumns(), need);
        sh.getRange(1, start, 1, missing.length).setValues([missing]).setFontWeight('bold');
        sh.setFrozenRows(1);
    };
    // 빈 스프레드시트에서 실행하면 발굴등록 탭부터 새로 만든다 (이미 있는 탭은 헤더 행이 다를 수 있어 건드리지 않음)
    if (!PASTE_TABS.some((n) => ss.getSheetByName(n))) tab('발굴등록', ['양식 붙여넣기', '처리결과']);
    pasteTab_();
    tab(MEMBERS, ['고유번호', '지역', '팀', '이름']);
    // 예전 버전이 만든 전체명단의 '고유번호' 칸은 '번호' 칸으로 이름만 바꿔 쓴다
    const old = ss.getSheetByName(ALL);
    if (old && old.getLastColumn()) {
        const hs = old.getRange(1, 1, 1, old.getLastColumn()).getValues()[0].map(norm_);
        if (hs.includes('고유번호') && !hs.includes('번호'))
            old.getRange(1, hs.indexOf('고유번호') + 1).setValue('번호');
    }
    tab(ALL, ALL_COLS);
    setupGoalTabs_(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM'));
    setupTeachersTab_();
    if (!ss.getSheetByName('사용법')) {
        const g = ss.insertSheet('사용법');
        g.getRange(1, 1, GUIDE.length, 2).setValues(GUIDE);
        g.getRange(1, 1, 1, 2).setFontWeight('bold');
        g.autoResizeColumns(1, 2);
    }
    // 새 스프레드시트의 빈 기본 탭은 지운다
    ss.getSheets()
        .filter((sh) => /^(시트|Sheet)\d+$/.test(sh.getName()) && sh.getLastRow() === 0)
        .forEach((sh) => ss.deleteSheet(sh));
}

const GUIDE = [
    ['양식 (발굴등록 탭 A열에 한 줄씩 붙여넣기)', '23시에 하는 일'],
    ['발/이름/연락처/생년/성별/인도자지역/인도자팀/인도자이름/도구', '전체명단에 새로 등록'],
    [
        '찾기/이름/전화번호(뒷4자리)/성별/생년/발굴유형/인도자이름/고유번호',
        '이름+뒷4자리로 찾아 현재상태 찾 (고유번호 = 인도자 고유번호)',
    ],
    ['합/이름/인도자지역/인도자이름/교사지역/교사이름/신앙유형', '이름+인도자이름으로 찾아 현재상태 합'],
    ['섭·복·예정·가능·확정/이름/인도자지역/인도자이름/교사지역/교사이름', '이름+인도자이름으로 찾아 그 단계로'],
    ['탈락/이름/연락처/인도자지역/인도자팀/인도자이름/탈락사유', '이름+뒷4자리로 찾아 현재상태 탈'],
    ['찾탈·합탈·복탈/이름/인도자지역/인도자이름/교사지역/교사이름/탈락사유', '이름+인도자이름으로 찾아 그 단계로'],
    ['', ''],
    ['명단 탭', '인도자·교사 목록 (고유번호/지역/팀/이름). 인도자·교사 고유번호는 여기서 찾는다'],
    ['전체명단 탭', '한 사람당 한 줄로 누적되는 결과. 직접 고치지 말고 양식으로 갱신'],
    ['현재명단 탭', '전체명단에서 탈락(탈·찾탈·합탈·복탈) 뺀 명단. 23시마다 새로 쓰니 직접 고치지 않는다'],
    ['개강설정 탭', '개강월(2026-12)마다 1주차시작일·주차수·단계 배수. 발·찾은 발굴 주차(주차수-5)까지, 합 이후는 개강 끝까지 실적'],
    ['목표 탭', '개강월·지역·팀마다 예정목표 점수. 단계 목표 = 예정목표 × 배수 (jdb 와 같음)'],
    ['교사 탭', '교사 한 명당 한 줄: 교사 관리(교사형태) · 상중하 평가(등급·평가항목·평가일) · 교사 프로필. 담당 학생·활동여부는 웹에서 전체명단으로 계산'],
    ['처리결과 칸', "'완료 날짜' 또는 '오류: 사유'. 오류 줄은 고쳐 두면 다음 날 다시 처리"],
];

function organizeSheet() {
    const lock = LockService.getDocumentLock();
    lock.waitLock(30000); // 손으로 실행한 것과 23시 실행이 겹치지 않게
    try {
        setupSheet();
        const ss = SpreadsheetApp.getActive();
        const paste = pasteTab_();
        const mem = ss.getSheetByName(MEMBERS);
        const all = ss.getSheetByName(ALL);
        const lines = paste.sh
            .getDataRange()
            .getValues()
            .slice(paste.h + 1)
            .map((r) => ({ text: String(r[0] ?? '').trim(), result: String(r[paste.resCol] ?? '') }));
        const members = readTable_(mem);
        const students = readTable_(all);
        const before = students.rows.map((o) => JSON.stringify(o));
        const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
        const { results } = process_(lines, students.rows, members.rows, today);
        if (results.length) {
            // shortcut: 바뀐 줄은 줄 전체를 다시 쓴다. 23시 실행 중 몇 초 사이에 그 줄을 손으로 고치면 덮일 수 있음
            writeChanged_(all, students, before);
            results.forEach((r) => paste.sh.getRange(paste.h + 2 + r.i, paste.resCol + 1).setValue(r.text));
        }
        // 전체명단을 손으로 고친 것도 반영되게 매번 새로 쓴다
        writeCurrent_(ss, students);
    } finally {
        lock.releaseLock();
    }
}

// 붙여넣는 탭과 헤더 행(A열이 '양식 붙여넣기'인 행, 없으면 1행), '처리결과' 칸 위치. 처리결과 칸이 없으면 헤더 끝에 만든다
function pasteTab_() {
    const ss = SpreadsheetApp.getActive();
    const sh = PASTE_TABS.map((n) => ss.getSheetByName(n)).find(Boolean);
    if (!sh) throw new Error(`'${PASTE_TABS.join("' 또는 '")}' 탭이 없습니다.`);
    const values = sh.getDataRange().getValues();
    const h = Math.max(
        0,
        values.findIndex((r) => norm_(r[0]) === '양식붙여넣기'),
    );
    const headers = values[h].map(norm_);
    let resCol = headers.indexOf('처리결과');
    if (resCol < 0) {
        resCol = headers.length;
        if (sh.getMaxColumns() <= resCol) sh.insertColumnsAfter(sh.getMaxColumns(), 1);
        sh.getRange(h + 1, resCol + 1)
            .setValue('처리결과')
            .setFontWeight('bold');
    }
    return { sh, h, resCol };
}

// 첫 행을 헤더로 읽어 { headers, rows: [{헤더: 값}] }. 명단의 '구역' 헤더는 '팀'으로도 읽힌다
// 헤더가 비었거나 겹치는 칸은 '__칸31' 처럼 위치로 이름 붙여 값이 서로 덮이지 않게 한다
// rowNums: 각 줄의 시트 행 번호 (빈 줄을 건너뛰어도 제자리에 다시 쓰기 위해)
function readTable_(sh) {
    const values = sh.getDataRange().getValues();
    const labels = values[0].map((v) => String(v ?? ''));
    const raw = labels.map(norm_);
    const headers = raw.map((h, i) => (!h || raw.indexOf(h) !== i ? `__칸${i + 1}` : h));
    const cell = (v) =>
        v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd') : String(v ?? '').trim();
    const rows = [];
    const rowNums = [];
    values.slice(1).forEach((r, k) => {
        const o = Object.fromEntries(headers.map((h, i) => [h, cell(r[i])]));
        if (!Object.values(o).some(Boolean)) return;
        if (o.팀 === undefined && o.구역 !== undefined) o.팀 = o.구역;
        rows.push(o);
        rowNums.push(k + 2);
    });
    return { headers, labels, rows, rowNums };
}

// 바뀐 줄(idx)만 쓸 위치를 정한다: 기존 줄은 제자리, 새 줄은 lastRow 아래로. 이어진 행끼리 묶음
function planWrites_(rowNums, idx, lastRow) {
    let next = lastRow + 1;
    const t = idx.map((i) => ({ i, n: i < rowNums.length ? rowNums[i] : next++ })).sort((a, b) => a.n - b.n);
    const batches = [];
    for (const x of t) {
        const b = batches[batches.length - 1];
        if (b && x.n === b.start + b.idx.length && b.idx.length < 2000) b.idx.push(x.i);
        else batches.push({ start: x.n, idx: [x.i] });
    }
    return batches;
}

// 전체명단에서 바뀐 줄·새 줄만 쓴다 (3만 줄을 통째로 쓰면 구글이 '알 수 없는 오류'를 낸다)
function writeChanged_(sh, table, before) {
    const idx = table.rows.map((o, i) => i).filter((i) => i >= before.length || JSON.stringify(table.rows[i]) !== before[i]);
    const batches = planWrites_(table.rowNums, idx, sh.getLastRow());
    const lastNeeded = Math.max(0, ...batches.map((b) => b.start + b.idx.length - 1));
    if (lastNeeded > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), lastNeeded - sh.getMaxRows());
    batches.forEach((b) => writeRows_(sh, b.start, table.headers, b.idx.map((i) => table.rows[i])));
    return idx.length;
}

function writeRows_(sh, startRow, headers, rows) {
    if (!rows.length) return;
    const data = rows.map((o) => headers.map((h) => (h === '구역' ? o.팀 : o[h]) ?? ''));
    // 텍스트 서식으로 써야 연락처 0567, 고유번호 00123 의 앞자리 0이 안 사라진다
    sh.getRange(startRow, 1, data.length, headers.length).setNumberFormat('@').setValues(data);
}

const norm_ = (v) => String(v ?? '').replace(/\s/g, '');
const last4_ = (v) => {
    const d = norm_(v).replace(/\D/g, '').slice(-4);
    return d && d.padStart(4, '0');
};
// 탈락(탈·찾탈·합탈…)했거나 센등한 사람은 양식 적용 대상에서 뺀다 (다시 발로 등록하면 새 줄로 쌓임)
const active_ = (s) => !/탈|센등/.test(s.현재상태 ?? '');

// 숫자인 값 중 가장 큰 수 (없으면 0). 숫자가 아닌 값은 무시
const maxNo_ = (list) => Math.max(0, ...list.map((v) => (/^\d+$/.test(String(v ?? '').trim()) ? Number(v) : 0)));

// jdb normalizeTeam: "1" / "1팀" / "1-3" → "1",  "사랑" / "사랑팀" / "사랑-1" → "사랑"
const normalizeTeam_ = (team) => {
    const t = String(team ?? '')
        .trim()
        .replace(/[–—]/g, '-');
    if (t.includes('사랑')) return '사랑';
    return t.split('-')[0].replace(/팀$/, '').trim();
};

// 붙여넣은 줄을 위에서부터 적용. students·members 를 고치고, 줄마다 처리결과를 돌려준다
function process_(lines, students, members, today) {
    const results = [];
    // 번호가 빈 사람(예전에 쌓인 줄)도 위에서부터 이어서 매긴다
    let no = maxNo_(students.map((s) => s.번호));
    students.forEach((s) => {
        if (!s.번호) s.번호 = String(++no);
    });
    lines.forEach((line, i) => {
        if (!line.text || line.result.startsWith('완료')) return;
        const parts = line.text.split(line.text.includes('\t') ? '\t' : '/').map((s) => s.trim());
        const kind = STAGE[parts[0]];
        if (!kind) {
            results.push({ i, text: `오류: 모르는 단계 '${parts[0]}'` });
            return;
        }
        const f = Object.fromEntries(FORMS[kind].map((n, k) => [n, parts[k] ?? '']));
        try {
            apply_(kind, f, students, members, today);
            results.push({ i, text: '완료 ' + today });
        } catch (e) {
            results.push({ i, text: '오류: ' + e.message });
        }
    });
    return { results };
}

function apply_(kind, f, students, members, today) {
    if (!f.이름) throw new Error('이름이 없습니다');
    const status = STATUS[f.단계] ?? f.단계;
    const dateCol = DATE_COL[f.단계] ?? f.단계 + '날짜';
    const person = (role, prefer) =>
        findMember_(members, role, f[role + '지역'], f[role + '팀'] ?? '', f[role + '이름'], prefer);

    if (kind === '발') {
        if (students.some((s) => active_(s) && s.이름 === f.이름 && last4_(s.연락처) === last4_(f.연락처)))
            throw new Error('이미 전체명단에 있습니다');
        const ind = person('인도자');
        students.push({
            번호: String(maxNo_(students.map((s) => s.번호)) + 1),
            현재상태: status,
            이름: f.이름,
            연락처: f.연락처,
            생년: f.생년,
            성별: f.성별,
            도구: f.도구,
            인도자지역: ind.지역,
            인도자팀: ind.팀 || f.인도자팀,
            인도자이름: ind.이름,
            인도자고유번호: ind.고유번호,
            [dateCol]: today,
        });
        return;
    }

    const byPhone = FORMS[kind].includes('연락처');
    const cands = students.filter(
        (s) =>
            active_(s) &&
            s.이름 === f.이름 &&
            (byPhone
                ? !f.연락처 || last4_(s.연락처) === last4_(f.연락처)
                : !f.인도자이름 || s.인도자이름 === f.인도자이름),
    );
    if (!cands.length) throw new Error('전체명단에 이 사람이 없습니다 (발 등록이 먼저 필요)');
    if (cands.length > 1) throw new Error(`전체명단에 같은 사람이 ${cands.length}명입니다`);
    const s = cands[0];

    // 명단 조회를 먼저 다 끝내고 한 번에 반영 (중간에 실패하면 이 사람은 그대로)
    const upd = { 현재상태: status, [dateCol]: today };
    for (const role of ['인도자', '교사']) {
        if (!f[role + '지역'] || !f[role + '이름']) continue;
        const m = person(role, s[role + '팀']);
        Object.assign(upd, {
            [role + '지역']: m.지역,
            [role + '팀']: m.팀,
            [role + '이름']: m.이름,
            [role + '고유번호']: m.고유번호,
        });
    }
    // 찾기 양식은 인도자를 고유번호로 직접 준다
    if (f.인도자고유번호) {
        const m = members.find((m) => m.고유번호 === f.인도자고유번호);
        if (!m) throw new Error(`인도자 고유번호 ${f.인도자고유번호}: 명단에 없습니다`);
        if (f.인도자이름 && m.이름 !== f.인도자이름)
            throw new Error(`인도자 고유번호 ${f.인도자고유번호} 는 명단에서 ${m.이름} 입니다 (양식: ${f.인도자이름})`);
        Object.assign(upd, { 인도자지역: m.지역, 인도자팀: m.팀, 인도자이름: m.이름, 인도자고유번호: m.고유번호 });
    }
    for (const n of ['성별', '생년', '발굴유형', '신앙유형', '탈락사유']) if (f[n]) upd[n] = f[n];
    Object.assign(s, upd);
}

// jdb resolveMember 와 같은 규칙. prefer: 팀 칸이 없는 양식에서 동명이인을 가를 기존 팀
function findMember_(members, role, 지역, 팀, 이름, prefer) {
    const region = String(지역 ?? '').trim();
    const name = String(이름 ?? '').trim();
    const team = String(팀 ?? '').trim();
    if (!region || !name) throw new Error(`${role} 지역·이름이 없습니다`);
    const label = `${role} ${region} ${team ? team + '팀 ' : ''}${name}`;
    const same = members.filter((m) => m.지역 === region && m.이름 === name);

    if (FREE_TEAM_REGIONS.includes(region)) {
        if (!same.length) throw new Error(`${label}: 명단에 없습니다`);
        return (team && same.find((m) => m.팀 === team)) || same[0];
    }

    const c = team ? same.filter((m) => normalizeTeam_(m.팀) === normalizeTeam_(team)) : same;
    if (!c.length) throw new Error(`${label}: 명단에 없습니다`);
    if (c.length === 1) return c[0];
    const exact = team
        ? c.filter((m) => m.팀 === team)
        : c.filter((m) => prefer && normalizeTeam_(m.팀) === normalizeTeam_(prefer));
    if (exact.length === 1) return exact[0];
    throw new Error(`${label}: 동명이인 (${c.map((m) => m.팀).join(', ')})${team ? ', 팀에 세부 구역까지 입력' : ''}`);
}

// 편집기에서 실행 → 로그에 OK 가 나오면 정상
function testOrganize() {
    const members = [
        { 고유번호: '7', 지역: '새신자', 팀: '2-1', 이름: '민찬홍' },
        { 고유번호: 'M2', 지역: '도봉', 팀: '1-1', 이름: '김교사' },
        { 고유번호: 'M3', 지역: '도봉', 팀: '5-1', 이름: '박교사' },
        { 고유번호: 'M4', 지역: '도봉', 팀: '3', 이름: '박교사' },
        { 고유번호: '8', 지역: '타지파', 팀: '', 이름: '홍길동' },
    ];
    const lines = [
        '발/이창환/010-1234-9776/20대초/남/새신자/2/민찬홍/노방',
        '찾기/이창환/9776/남/980101/노방/민찬홍/7',
        '합/이창환/새신자/민찬홍/도봉/김교사/모태',
        '예정/이창환/새신자/민찬홍/도봉/박교사',
        '복탈/이창환/새신자/민찬홍/도봉/김교사/연락두절',
        '발/김민지/0123/30대/여/타지파/1/홍길동/지인',
        '탈락/김민지/0123/타지파/1/홍길동/이사',
        '발/없는/1111/30대/남/도봉/9/아무개/노방',
        '찾기/이창환/9776/남/30/노방/민찬홍/M2',
        '섭복/이창환',
        '발/최지은/2222/30대/여/타부서//없는사람/지인',
    ].map((text) => ({ text, result: '' }));
    lines.push({ text: '발/이창환/010-1234-9776/20대초/남/새신자/2/민찬홍/노방', result: '완료 2026-11-24' });
    lines.push({ text: '발/박옛날/5555/30대/남/새신자/2/민찬홍/노방', result: '' });
    const students = [{ 번호: '5', 현재상태: '탈', 이름: '박옛날', 연락처: '5555', 인도자이름: '민찬홍' }];
    const { results } = process_(lines, students, members, '2026-11-25');
    const [old, lee, kim, again] = students;
    const errs = results.filter((r) => r.text.startsWith('오류')).map((r) => r.i);
    const ok =
        students.length === 4 && old.현재상태 === '탈' && again.현재상태 === '발' && again.번호 === '8' &&
        lee.현재상태 === '복탈' &&
        lee.인도자고유번호 === '7' &&
        lee.인도자팀 === '2-1' &&
        lee.고유번호 === undefined &&
        lee.교사고유번호 === 'M2' &&
        lee.교사팀 === '1-1' &&
        lee.신앙유형 === '모태' &&
        lee.탈락사유 === '연락두절' &&
        lee.합날짜 === '2026-11-25' &&
        lee.찾기날짜 === '2026-11-25' &&
        lee.복탈날짜 === '2026-11-25' &&
        kim.현재상태 === '탈' &&
        kim.발굴탈락날짜 === '2026-11-25' &&
        kim.인도자고유번호 === '8' &&
        lee.번호 === '6' &&
        kim.번호 === '7' &&
        errs.join() === '3,7,8,9,10' &&
        results.length === 12 &&
        results[3].text.includes('동명이인');
    Logger.log(ok ? 'OK' : 'FAIL ' + JSON.stringify({ results, students }, null, 1));
}

// 현재명단 탭: 전체명단에서 탈락 계열을 뺀 줄
function writeCurrent_(ss, { headers, labels, rows }) {
    const sh = ss.getSheetByName(CURRENT) || ss.insertSheet(CURRENT);
    if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    sh.clearContents();
    sh.getRange(1, 1, 1, headers.length).setValues([labels]).setFontWeight('bold');
    sh.setFrozenRows(1);
    writeRows_(sh, 2, headers, rows.filter((r) => !/탈/.test(r.현재상태 ?? '')));
}

function testWrites() {
    const b = planWrites_([2, 3, 5, 6, 7], [0, 1, 3, 4, 5, 6], 7);
    const ok = JSON.stringify(b) === JSON.stringify([{ start: 2, idx: [0, 1] }, { start: 6, idx: [3, 4, 5, 6] }]);
    Logger.log(ok ? 'OK' : 'FAIL ' + JSON.stringify(b));
}

const SETTINGS_COLS = ['개강월', '1주차시작일', '주차수', '발배수', '찾배수', '합배수', '섭배수', '복배수'];
const GOALS_COLS = ['개강월', '지역', '팀', '예정목표'];

// 개강설정·목표 탭이 없으면 이번 달·다음 달 개강을 jdb 기본값으로 채워 만든다 (있으면 건드리지 않음)
function setupGoalTabs_(thisMonth) {
    const ss = SpreadsheetApp.getActive();
    const months = [thisMonth, nextMonth_(thisMonth)];
    const make = (name, cols, rows) => {
        if (ss.getSheetByName(name)) return;
        const sh = ss.insertSheet(name);
        const data = [cols, ...rows].map((r) => cols.map((_, i) => String(r[i] ?? '')));
        sh.getRange(1, 1, data.length, cols.length).setNumberFormat('@').setValues(data);
        sh.getRange(1, 1, 1, cols.length).setFontWeight('bold');
        sh.setFrozenRows(1);
    };
    make(SETTINGS_TAB, SETTINGS_COLS, months.map((m) => [m, defaultWeek1Start_(m), 8, 30, 10, 4, 2, 1.5]));
    make(GOALS_TAB, GOALS_COLS, months.flatMap(defaultGoals_));
}

const nextMonth_ = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
};

// jdb getDefaultWeek1Start (2026년 이후): 그 달 첫 월요일의 5주 전
function defaultWeek1Start_(m) {
    const [y, mo] = m.split('-').map(Number);
    const d = new Date(Date.UTC(y, mo - 1, 1));
    const dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + (dow === 1 ? 0 : (8 - dow) % 7) - 35);
    return d.toISOString().slice(0, 10);
}

// jdb get_DEFAULT_예정_goals: 짝수 달 / 홀수 달 팀별 예정 목표 점수
function defaultGoals_(m) {
    const even = Number(m.split('-')[1]) % 2 === 0;
    const t = even
        ? {
              도봉: { 1: 1.5, 2: 1.5, 3: 1.5, 사랑: 0.5 }, 성북: { 1: 1.5, 2: 1.5, 3: 1.5, 사랑: 0.5 },
              노원: { 1: 1.5, 2: 1.5, 3: 1.5, 사랑: 0.5 }, 중랑: { 1: 2, 2: 2, 3: 1, 사랑: 0 },
              강북: { 1: 1.5, 2: 1.5, 3: 1.5, 사랑: 0.5 }, 대학: { 1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 사랑: 0 },
              새신자: { 1: 1.5, 2: 1.5 }, 이음: { 1: 1 },
          }
        : {
              도봉: { 1: 0.5, 2: 0.5, 3: 0.5, 사랑: 0.5 }, 성북: { 1: 0.5, 2: 0.5, 3: 0.5, 사랑: 0.5 },
              노원: { 1: 0.5, 2: 0.5, 3: 0.5, 사랑: 0.5 }, 중랑: { 1: 1, 2: 0.5, 3: 0.5, 사랑: 0 },
              강북: { 1: 0.5, 2: 0.5, 3: 0.5, 사랑: 0.5 }, 대학: { 1: 3, 2: 3, 3: 3, 4: 3, 사랑: 0 },
              새신자: { 1: 3, 2: 3 }, 이음: { 1: 1 },
          };
    // 객체 키는 숫자가 먼저 나오므로 사랑이 각 지역 마지막
    return Object.entries(t).flatMap(([region, teams]) => Object.entries(teams).map(([team, g]) => [m, region, team, g]));
}

function testGoalDefaults() {
    const ok =
        defaultWeek1Start_('2026-12') === '2026-11-02' && // 12월 첫 월요일 12-07 의 5주 전
        defaultWeek1Start_('2026-11') === '2026-09-28' && // 11월 첫 월요일 11-02 의 5주 전
        nextMonth_('2026-12') === '2027-01' &&
        defaultGoals_('2026-12').length === 28 &&
        defaultGoals_('2026-12').filter((r) => r[1] === '도봉').reduce((a, r) => a + r[3], 0) === 5 &&
        defaultGoals_('2026-11').filter((r) => r[1] === '대학').reduce((a, r) => a + r[3], 0) === 12;
    Logger.log(ok ? 'OK' : 'FAIL ' + JSON.stringify([defaultWeek1Start_('2026-12'), defaultWeek1Start_('2026-11'), defaultGoals_('2026-12')]));
}

// jdb 교사 관리(teachers) + 상중하 평가(teacher_evaluations) + 교사 프로필(teacher_profiles) 을 한 줄로
const TEACHER_COLS = [
    '고유번호', '지역', '팀', '이름', '교사형태', '등급', '평가항목', '평가일',
    '성별', '출생연도', '종교', '신앙연수', 'MBTI', '에니어그램', '전공', '직업', '취미', '자격증', '선호사항', '가능시간', '메모',
];

// 교사 탭이 없으면 만들고 교사형태·등급 칸에 고르기 목록을 단다 (있으면 빠진 칸만 오른쪽에 추가)
function setupTeachersTab_() {
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName(TEACHERS_TAB);
    const created = !sh;
    if (!sh) sh = ss.insertSheet(TEACHERS_TAB);
    const have = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(norm_) : [];
    const missing = TEACHER_COLS.filter((c) => !have.includes(norm_(c)));
    if (missing.length) {
        const need = have.length + missing.length - sh.getMaxColumns();
        if (need > 0) sh.insertColumnsAfter(sh.getMaxColumns(), need);
        sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
        sh.setFrozenRows(1);
    }
    if (!created) return;
    const list = (col, values) =>
        sh.getRange(2, TEACHER_COLS.indexOf(col) + 1, sh.getMaxRows() - 1, 1).setDataValidation(
            SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build(),
        );
    list('교사형태', ['정교사', '교사', '예비교사']);
    list('등급', ['상', '중', '하']);
    // 고유번호·출생연도 앞자리 0 보존
    sh.getRange(2, 1, sh.getMaxRows() - 1, TEACHER_COLS.length).setNumberFormat('@');
    sh.getRange(1, TEACHER_COLS.indexOf('평가항목') + 1).setNote('예: 상①②③⑤ 또는 중①②④ (jdb 교사 기준표 항목)');
}

// 문제 찾기용: 편집기에서 diagnose 실행 → 실행 로그에 단계마다 '시작/끝'이 찍힌다.
// '알 수 없는 오류'로 멈추면 마지막에 찍힌 '시작'이 그 단계다
function diagnose() {
    const ss = SpreadsheetApp.getActive();
    let total = 0;
    ss.getSheets().forEach((sh) => {
        const cells = sh.getMaxRows() * sh.getMaxColumns();
        total += cells;
        console.log(`탭 ${sh.getName()}${sh.isSheetHidden() ? '(숨김)' : ''}: 격자 ${sh.getMaxRows()}x${sh.getMaxColumns()}, 데이터 ${sh.getLastRow()}x${sh.getLastColumn()}`);
    });
    console.log(`전체 칸 수 ${total} (구글 한도 10,000,000)`);
    const step = (name, fn) => {
        console.log(`시작: ${name}`);
        const t = Date.now();
        try {
            fn();
            console.log(`끝: ${name} (${Date.now() - t}ms)`);
        } catch (e) {
            console.log(`오류: ${name} → ${e && e.stack ? e.stack : e}`);
        }
    };
    step('발굴등록 탭 읽기', () => pasteTab_());
    step('개강설정·목표 탭', () => setupGoalTabs_(Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM')));
    step('교사 탭', () => setupTeachersTab_());
    step('명단 읽기', () => console.log(`  명단 ${readTable_(ss.getSheetByName(MEMBERS)).rows.length}줄`));
    step('전체명단 읽기', () => console.log(`  전체명단 ${readTable_(ss.getSheetByName(ALL)).rows.length}줄`));
    step('setupSheet 전체', () => setupSheet());
}

// 문제 찾기 1단계: 아무것도 안 하는 함수. 이것도 '알 수 없는 오류'면 코드가 아니라 프로젝트(파일 중복·권한)나 구글 쪽 문제
function ping() {
    console.log('ping OK');
    console.log('시트 이름: ' + SpreadsheetApp.getActive().getName());
}
