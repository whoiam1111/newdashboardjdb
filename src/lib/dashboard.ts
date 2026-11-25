import type { User } from './session';

type Row = Record<string, string>;

// 진행 중으로 세는 단계 (센등·탈락 계열은 제외)
export const STAGES = ['발', '찾', '합', '섭', '복', '예정', '가능', '확정', '센확'];
const DROP_DATES = ['발굴탈락날짜', '찾탈날짜', '합탈날짜', '복탈날짜'];

// jdb 지역 계정과 같은 범위: 인도자나 교사가 자기 지역인 사람
const inScope = (r: Row, user: User) => !user.region || r.인도자지역 === user.region || r.교사지역 === user.region;
export const forUser = <T extends Row>(records: T[], user: User) => records.filter((r) => inScope(r, user));

// 탈·찾탈·합탈·복탈·탈락 등
export const isDropped = (r: Row) => /탈/.test(r.현재상태 ?? '');

export const DUP_COLS = ['번호', '현재상태', '연락처', '인도자지역', '인도자팀', '인도자이름', '교사지역', '교사이름', '발굴등록날짜'];

// 이름 + 연락처 뒷4자리가 같은데 인도자 지역이 2곳 이상인 묶음. 연락처가 4자리 미만이면 비교하지 않는다
// 지역 계정은 묶음 안에 자기 지역 사람이 있을 때만 보고, 그 묶음의 다른 지역 줄도 함께 본다 (중복 확인용)
export function findDuplicates(records: Row[], user: User, includeDropped: boolean) {
    const groups = new Map<string, Row[]>();
    for (const r of records) {
        if (!includeDropped && isDropped(r)) continue;
        const name = (r.이름 ?? '').trim();
        const phone = (r.연락처 ?? '').replace(/\D/g, '').slice(-4);
        if (!name || phone.length < 4) continue;
        const key = `${name}|${phone}`;
        groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return [...groups]
        .filter(([, rows]) => new Set(rows.map((r) => r.인도자지역 || '(없음)')).size >= 2 && rows.some((r) => inScope(r, user)))
        .map(([key, rows]) => ({
            key,
            이름: key.split('|')[0],
            연락처: key.split('|')[1],
            지역: [...new Set(rows.map((r) => r.인도자지역 || '(없음)'))],
            // 내 범위 밖 줄의 연락처는 뒤 4자리만 (비교에는 그것만 필요)
            rows: rows.map((r) => {
                const row = Object.fromEntries(DUP_COLS.map((c) => [c, r[c] ?? '']));
                if (!inScope(r, user)) row.연락처 = row.연락처.replace(/\d(?=(?:\D*\d){4})/g, '*');
                return row;
            }),
        }))
        .sort((a, b) => a.이름.localeCompare(b.이름, 'ko'));
}
export type DupGroup = ReturnType<typeof findDuplicates>[number];

// '2026-11-25', '2026. 11. 25' 모두 '2026-11'
const monthOf = (v = '') => {
    const m = v.match(/^(\d{4})\D+(\d{1,2})/);
    return m ? `${m[1]}-${m[2].padStart(2, '0')}` : '';
};

// 관리자는 인도자지역별, 지역 계정은 자기 지역 인도자 팀별로 나눈다
export function summarize(records: Row[], user: User, month: string) {
    const active = records.filter((r) => STAGES.includes(r.현재상태));
    const count = (rows: Row[]) => Object.fromEntries(STAGES.map((s) => [s, rows.filter((r) => r.현재상태 === s).length]));
    const inMonth = (col: string) => records.filter((r) => monthOf(r[col]) === month).length;
    const groupOf = (r: Row) =>
        !user.region
            ? r.인도자지역 || '(없음)'
            : r.인도자지역 === user.region
              ? `${(r.인도자팀 || '').split('-')[0] || '(팀 없음)'}팀`
              : '다른 지역 인도자';
    const groups = new Map<string, Row[]>();
    for (const r of active) groups.set(groupOf(r), [...(groups.get(groupOf(r)) ?? []), r]);
    return {
        total: active.length,
        byStage: count(active),
        month: {
            발굴: inMonth('발굴등록날짜'),
            찾기: inMonth('찾기날짜'),
            합: inMonth('합날짜'),
            탈락: records.filter((r) => DROP_DATES.some((c) => monthOf(r[c]) === month)).length,
        },
        groupBy: user.region ? '인도자 팀' : '인도자 지역',
        groups: [...groups]
            .map(([name, rows]) => ({ name, total: rows.length, ...count(rows) }))
            .sort((a, b) => b.total - a.total),
    };
}

export type Summary = ReturnType<typeof summarize>;
