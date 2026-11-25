import { isDropped } from './dashboard';
import { normalizeTeam, table } from './goals';
import type { User } from './session';

type Row = Record<string, string>;

export const PROFILE_COLS = ['성별', '출생연도', '종교', '신앙연수', 'MBTI', '에니어그램', '전공', '직업', '취미', '자격증', '선호사항', '가능시간'];
// jdb 교사매칭: 합 이상 단계에서 교사로 붙은 학생
const MATCH_STAGES = ['합', '섭', '복', '예정', '가능', '확정', '센확'];

// row: 교사 탭의 그 줄 (헤더 → 값)
export type TeacherView = { key: string; row: Row; 담당: string[]; 활동: boolean; 프로필: boolean };

// 교사 탭 + 전체명단 → 교사 관리 목록. 지역 계정은 자기 지역 교사만
// 담당 학생: 교사고유번호가 같거나, 고유번호가 없으면 교사지역+교사이름(+팀 앞부분)이 같은 진행 중 학생
// 같은 고유번호(없으면 지역+팀+이름) 줄이 여러 개면 한 명으로 합친다: 앞 줄 값 우선, 빈 칸은 뒤 줄 값으로
export function buildTeachers(values: string[][], students: Row[], user: User) {
    const active = students.filter((s) => !isDropped(s) && MATCH_STAGES.includes(s.현재상태));
    const merged = new Map<string, Row>();
    let duplicates = 0;
    for (const t of table(values)) {
        if (!t.이름 || t.이름 === '이름') continue; // 빈 줄, 가져오기 때 끼어든 헤더 줄
        const k = t.고유번호 || `${t.지역}|${t.팀}|${t.이름}`;
        const prev = merged.get(k);
        if (prev) duplicates++;
        merged.set(k, prev ? Object.fromEntries(Object.keys({ ...prev, ...t }).map((c) => [c, prev[c] || t[c]])) : t);
    }
    const teachers: TeacherView[] = [...merged]
        .filter(([, t]) => !user.region || t.지역 === user.region)
        .map(([key, t]) => {
            const mine = active.filter((s) =>
                s.교사고유번호 && t.고유번호
                    ? s.교사고유번호 === t.고유번호
                    : s.교사지역 === t.지역 &&
                      s.교사이름 === t.이름 &&
                      (!t.팀 || !s.교사팀 || normalizeTeam(s.교사팀) === normalizeTeam(t.팀)),
            );
            return {
                // 등급이 비었거나 상·중이 아니면 하
                row: { ...t, 등급: ['상', '중'].includes(t.등급) ? t.등급 : '하' },
                key,
                담당: mine.map((s) => `${s.이름}(${s.현재상태})`),
                활동: mine.length > 0,
                프로필: PROFILE_COLS.some((c) => t[c]),
            };
        });
    return { teachers, duplicates };
}

// '1990', '90', '20대', '20대초/중/후' → 대략 나이. 모르면 null
export function ageOf(v = '', year = new Date().getFullYear()) {
    const s = v.replace(/\s/g, '');
    const dec = s.match(/^(\d)0대(초|중|후)?/);
    if (dec) return Number(dec[1]) * 10 + ({ 초: 2, 중: 5, 후: 8 }[dec[2] as '초'] ?? 5);
    const y = s.match(/^(\d{4}|\d{2})(?!\d)/)?.[1];
    if (!y) return null;
    const full = y.length === 4 ? Number(y) : 1900 + Number(y) + (Number(y) + 2000 <= year ? 100 : 0);
    return year - full >= 0 && year - full < 100 ? year - full : null;
}

export type MatchWant = { 성별?: string; 나이?: string; 지역?: string; 키워드?: string; 같은성별만?: boolean };
export type Match = { t: TeacherView; score: number; reasons: string[] };

// 교사 매칭 점수. 점수가 높을수록 추천, reasons 에 왜 점수를 줬는지
export function matchTeachers(teachers: TeacherView[], want: MatchWant, year = new Date().getFullYear()): Match[] {
    const sex = (v = '') => v.trim().slice(0, 1); // '남자' → '남'
    const age = ageOf(want.나이, year);
    const words = (want.키워드 ?? '').split(/[\s,]+/).filter(Boolean);
    return teachers
        .filter((t) => !want.같은성별만 || !want.성별 || sex(t.row.성별) === sex(want.성별))
        .map((t) => {
            const r = t.row;
            const reasons: string[] = [];
            let score = 0;
            const add = (n: number, why: string) => ((score += n), reasons.push(why));
            if (want.성별 && sex(r.성별) === sex(want.성별)) add(3, '같은 성별');
            if (want.지역 && r.지역 === want.지역) add(2, '같은 지역');
            const ta = ageOf(r.출생연도, year);
            if (age !== null && ta !== null) {
                const gap = Math.abs(age - ta);
                if (gap <= 5) add(2, `나이 비슷 (±${gap})`);
                else if (gap <= 10) add(1, `나이 ±${gap}`);
            }
            if (r.등급 === '상') add(2, '등급 상');
            else if (r.등급 === '중') add(1, '등급 중');
            if (r.교사형태 === '정교사') add(1, '정교사');
            if (t.담당.length === 0) add(2, '담당 없음');
            else if (t.담당.length <= 2) add(1, `담당 ${t.담당.length}명`);
            else if (t.담당.length >= 5) add(-1, `담당 많음 ${t.담당.length}명`);
            const text = PROFILE_COLS.map((c) => r[c]).join(' ');
            for (const w of words) if (text.includes(w)) add(2, `'${w}'`);
            return { t, score, reasons };
        })
        .sort((a, b) => b.score - a.score || a.t.담당.length - b.t.담당.length);
}

// 지역별 비교 칸
export const COMPARE = {
    MBTI: ['E', 'I'],
    에니어그램: ['가슴형', '머리형', '장형'],
    성별: ['남', '여'],
    나이: ['20대초', '20대중', '20대후', '30대초', '30대중', '30대후'],
} as const;
// 에니어그램 번호 → 유형 (가슴 2·3·4, 머리 5·6·7, 장 8·9·1)
const ENNEA: Record<string, string> = { 2: '가슴형', 3: '가슴형', 4: '가슴형', 5: '머리형', 6: '머리형', 7: '머리형', 8: '장형', 9: '장형', 1: '장형' };

// 교사 한 명이 비교 칸 어디에 들어가는지. 값이 없거나 못 읽으면 그 칸은 빈 문자열
export function groupsOf(r: Record<string, string>, year = new Date().getFullYear()) {
    const mbti = (r.MBTI ?? '').trim().toUpperCase().slice(0, 1);
    const e = r.에니어그램 ?? '';
    const age = ageOf(r.출생연도, year);
    const band = age === null ? '' : `${Math.floor(age / 10) * 10}대${age % 10 <= 3 ? '초' : age % 10 <= 6 ? '중' : '후'}`;
    return {
        MBTI: ['E', 'I'].includes(mbti) ? mbti : '',
        에니어그램: e.match(/가슴|머리|장/)?.[0].concat('형') ?? ENNEA[e.match(/[1-9]/)?.[0] ?? ''] ?? '',
        성별: (r.성별 ?? '').trim().slice(0, 1),
        나이: band,
    };
}

// 지역별 비교 표: 지역마다 칸별 교사 수, 맨 아래 합계
export function compareRegions(teachers: TeacherView[], year = new Date().getFullYear()): Record<string, string | number>[] {
    const count = (list: TeacherView[]) => {
        const g = list.map((t) => groupsOf(t.row, year));
        const row: Record<string, number> = { 교사: list.length };
        for (const [k, vals] of Object.entries(COMPARE)) for (const v of vals) row[v] = g.filter((x) => x[k as keyof typeof COMPARE] === v).length;
        return row;
    };
    const regions = [...new Set(teachers.map((t) => t.row.지역 || '(없음)'))];
    return [
        ...regions.map((region) => ({ region, ...count(teachers.filter((t) => (t.row.지역 || '(없음)') === region)) })),
        { region: '합계', ...count(teachers) },
    ];
}

// 교사 조회 조건 (jdb 교사 조회와 같은 조건). 모두 만족하는 교사만 남긴다
export const TIME_SLOTS = ['평일 오전', '평일 오후', '평일 저녁', '주말 오전', '주말 오후', '주말 저녁'];
export type SearchFilters = {
    q: string;
    지역: string;
    성별: '' | '남' | '여';
    교사형태: '' | '정교사' | '교사' | '예비교사';
    times: string[];
    ageMin: string;
    ageMax: string;
    mbti: string;
    mbtiTarget: 'teacher' | 'preferred';
    ennea: string;
    enneaTarget: 'teacher' | 'preferred';
};
export const EMPTY_FILTERS: SearchFilters = { q: '', 지역: '', 성별: '', 교사형태: '', times: [], ageMin: '', ageMax: '', mbti: '', mbtiTarget: 'teacher', ennea: '', enneaTarget: 'teacher' };

const nospace = (v = '') => v.replace(/\s/g, '');
// 시트의 가능시간 칸에 들어 있는 시간대 ('평일저녁, 주말 오후' 처럼 띄어쓰기가 달라도)
export const timesOf = (v = '') => TIME_SLOTS.filter((s) => nospace(v).includes(nospace(s)));

export function searchTeachers(teachers: TeacherView[], f: SearchFilters, year = new Date().getFullYear()) {
    const q = f.q.trim();
    const mbti = nospace(f.mbti).toUpperCase();
    const ennea = /^[1-9]$/.test(f.ennea) ? f.ennea : '';
    const min = Number(f.ageMin) || 0;
    const max = Number(f.ageMax) || 0;
    return teachers.filter(({ row: r }) => {
        if (q && ![r.이름, r.직업, r.전공, r.자격증, r.취미, r.팀].some((v) => v?.includes(q))) return false;
        if (f.지역 && r.지역 !== f.지역) return false;
        if (f.성별 && (r.성별 ?? '').trim().slice(0, 1) !== f.성별) return false;
        if (f.교사형태 && r.교사형태 !== f.교사형태) return false;
        if (f.times.length) {
            const have = timesOf(r.가능시간);
            if (!f.times.every((t) => have.includes(t))) return false;
        }
        if (min || max) {
            const a = ageOf(r.출생연도, year);
            if (a === null || (min && a < min) || (max && a > max)) return false;
        }
        // MBTI 는 고른 글자가 모두 들어 있으면 (NF → ENFP, INFJ …)
        if (mbti) {
            const v = (f.mbtiTarget === 'preferred' ? r.선호사항 : r.MBTI)?.toUpperCase() ?? '';
            if (![...mbti].every((c) => v.includes(c))) return false;
        }
        if (ennea) {
            const ok = f.enneaTarget === 'preferred' ? new RegExp(`(^|[^0-9])${ennea}([^0-9]|$)`).test(r.선호사항 ?? '') : (r.에니어그램 ?? '').trim().startsWith(ennea);
            if (!ok) return false;
        }
        return true;
    });
}

// 이전 종교 "기독교,장로" → "기독교(장로)", 무교 → "무신앙"
const religionText = (v = '') => {
    const s = v.trim();
    if (!s) return '';
    if (s === '무교') return '무신앙';
    const [main, detail] = s.split(',');
    return detail ? `${main}(${detail.trim()})` : main;
};

// 교사프로필 양식 (jdb 와 같은 형식, 카톡에 그대로 붙여넣는다)
export function formatTeacherProfile(r: Record<string, string>, year = new Date().getFullYear()) {
    const faith = r.신앙연수 ? `${r.신앙연수.replace(/년$/, '')}년` : '';
    const spec = [r.자격증, r.전공, r.직업].map((v) => (v ?? '').trim()).filter(Boolean).join(', ');
    return [
        '⭐️ 교사프로필 ⭐️',
        '',
        `▪️이름/성별/나이: ${[r.이름, r.성별 ?? '', ageOf(r.출생연도, year) ?? ''].join('/')}`,
        `▪️S이전종교/신앙년수: ${[religionText(r.종교), faith].filter(Boolean).join('/')}`,
        `▪️MBTI: ${r.MBTI ?? ''}`,
        `▪️애니어: ${r.에니어그램 ?? ''}`,
        `▪️육적스펙, 전공, 종사 분야: ${spec}`,
        `▪️취미,특기,관심사: ${(r.취미 ?? '').trim()}`,
        '',
        `▪️만남가능 일시: ${timesOf(r.가능시간).join(', ')}`,
    ].join('\n');
}
