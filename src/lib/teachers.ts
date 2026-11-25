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
