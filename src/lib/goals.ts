import { REGION_IDS } from './accounts';

// jdb 목표 달성 규칙을 시트 값으로 (lib/goalPlan, goalScoring, campaignWindow 의 기본 동작)
// - 단계 목표 = 팀 예정목표 × 단계 배수 (기본 발 30 · 찾 10 · 합 4 · 섭 2 · 복 1.5 · 예정 1)
// - 점수: 발·찾·합은 인도자 1점, 섭·복·예정은 인도자 0.5 + 교사 0.5 (같은 팀이면 합쳐 1점)
// - 발·찾: 발굴 주차(주차수 - 5, 최소 1주) 안에 된 것, 합 이후: 개강 기간 안에 되고 목표월이 이 달(비어 있으면 인정)
// - 이월(개강 전 실적 넘겨받기)은 jdb 기본값처럼 하지 않는다
// 차이: 그 단계가 된 때가 아니라 지금 전체명단의 인도자·교사 지역·팀으로 센다

export const STEPS = ['발', '찾', '합', '섭', '복', '예정'] as const;
export type Step = (typeof STEPS)[number];
const DATE_COL: Record<Step, string> = { 발: '발굴등록날짜', 찾: '찾기날짜', 합: '합날짜', 섭: '섭날짜', 복: '복날짜', 예정: '예정날짜' };
const SPLIT = new Set<Step>(['섭', '복', '예정']);
const DEFAULT_MULT: Record<Step, number> = { 발: 30, 찾: 10, 합: 4, 섭: 2, 복: 1.5, 예정: 1 };

type Row = Record<string, string>;
const norm = (v = '') => v.replace(/\s/g, '');
const round = (n: number) => Math.round(n * 10) / 10;

// '2026-11-02', '2026. 11. 2' → '2026-11-02'
export const ymd = (v = '') => {
    const m = v.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
};
// '2026-12', '2026. 12', '2026년 12월' → '2026-12'
const monthKey = (v = '') => {
    const m = v.match(/^(\d{4})\D+(\d{1,2})/);
    return m ? `${m[1]}-${m[2].padStart(2, '0')}` : '';
};
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

// jdb normalizeTeam: "1" / "1팀" / "1-3" → "1",  "사랑" / "사랑-1" → "사랑"
export const normalizeTeam = (team = '') => {
    const t = team.trim().replace(/[–—]/g, '-');
    if (t.includes('사랑')) return '사랑';
    return t.split('-')[0].replace(/팀$/, '').trim();
};

// 헤더(공백 무시)로 칸을 찾아 행 객체로
export const table = (values: string[][]) => {
    const headers = (values[0] ?? []).map(norm);
    return values.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])) as Row);
};

export type Campaign = { month: string; start: string; end: string; balEnd: string; weeks: number; mult: Record<Step, number> };

export function parseCampaigns(settings: string[][]): Campaign[] {
    return table(settings)
        .map((r) => {
            const month = monthKey(r.개강월);
            const start = ymd(r['1주차시작일']);
            const weeks = Number(r.주차수) || 8;
            if (!month || !start) return null;
            const mult = Object.fromEntries(STEPS.map((s) => [s, s === '예정' ? 1 : Number(r[`${s}배수`]) || DEFAULT_MULT[s]]));
            return {
                month,
                start,
                end: addDays(start, weeks * 7 - 1),
                balEnd: addDays(start, Math.max(1, weeks - 5) * 7 - 1),
                weeks,
                mult: mult as Record<Step, number>,
            };
        })
        .filter((c): c is Campaign => !!c)
        .sort((a, b) => b.month.localeCompare(a.month));
}

// 오늘이 들어 있는 개강, 없으면 이미 시작한 가장 최근 개강, 그것도 없으면 가장 먼저 오는 개강
export const currentCampaign = (cs: Campaign[], today: string) =>
    cs.find((c) => c.start <= today && today <= c.end) ?? cs.find((c) => c.start <= today) ?? cs[cs.length - 1];

export type GoalRow = { region: string; team: string; goal: Record<Step, number>; actual: Record<Step, number> };

export function computeGoals(c: Campaign, goalValues: string[][], records: Row[]): GoalRow[] {
    const rows = new Map<string, GoalRow>();
    const get = (region: string, team: string) => {
        const k = `${region}|${team}`;
        if (!rows.has(k)) {
            const zero = () => Object.fromEntries(STEPS.map((s) => [s, 0])) as Record<Step, number>;
            rows.set(k, { region, team, goal: zero(), actual: zero() });
        }
        return rows.get(k)!;
    };
    for (const g of table(goalValues)) {
        if (monthKey(g.개강월) !== c.month) continue;
        const team = normalizeTeam(g.팀);
        if (!REGION_IDS.includes(g.지역) || !team) continue;
        const row = get(g.지역, team);
        for (const s of STEPS) row.goal[s] = round(row.goal[s] + (Number(g.예정목표) || 0) * c.mult[s]);
    }
    const monthNo = Number(c.month.slice(5));
    for (const r of records) {
        const target = Number((r.목표월 ?? '').replace(/\D/g, ''));
        for (const s of STEPS) {
            const d = ymd(r[DATE_COL[s]]);
            if (!d) continue;
            const ok = s === '발' || s === '찾' ? d >= c.start && d <= c.balEnd : d >= c.start && d <= c.end && (!target || target === monthNo);
            if (!ok) continue;
            const parts: [string, string, number][] = SPLIT.has(s)
                ? [[r.인도자지역, r.인도자팀, 0.5], [r.교사지역, r.교사팀, 0.5]]
                : [[r.인도자지역, r.인도자팀, 1]];
            for (const [region, team, score] of parts) {
                const t = normalizeTeam(team);
                if (!REGION_IDS.includes(region) || !t) continue;
                const row = get(region, t);
                row.actual[s] = round(row.actual[s] + score);
            }
        }
    }
    const teamOrder = (t: string) => (t === '사랑' ? 1000 : Number(t) || 999);
    return [...rows.values()].sort(
        (a, b) => REGION_IDS.indexOf(a.region) - REGION_IDS.indexOf(b.region) || teamOrder(a.team) - teamOrder(b.team),
    );
}
