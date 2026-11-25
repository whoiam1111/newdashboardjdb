// 전체명단은 Apps Script 웹 앱(apps-script/api.gs)에서 받는다. 조직 정책으로 서비스 계정 키를 못 만들어서
// '이름'이 있는 첫 행을 헤더로 (위에 제목 행이 있어도 됨), 이름이 빈 행은 버린다
export function toRecords(values: string[][]) {
    const h = Math.max(0, values.findIndex((r) => r.some((c) => c.trim() === '이름')));
    const headers = values[h] ?? [];
    const nameCol = headers.findIndex((c) => c.trim() === '이름');
    const records = values
        .slice(h + 1)
        .filter((r) => (nameCol < 0 ? r.some(Boolean) : r[nameCol]?.trim()))
        .map((r) => Object.fromEntries(headers.map((hd, c) => [hd, r[c] ?? ''])));
    return { headers, records: records.map((r, i) => ({ key: String(i), ...r })) };
}

// shortcut: 서버 메모리에 5분 캐시 (시트는 하루 한 번 23시에 바뀜). 서버가 여러 대면 대마다 따로 캐시
const cache = new Map<string, { at: number; data: Record<string, unknown> }>();

async function fetchApi(query: string, check: (d: Record<string, unknown>) => boolean) {
    const url = process.env.SHEET_API_URL;
    const token = process.env.SHEET_API_TOKEN;
    if (!url || !token) throw new Error('SHEET_API_URL / SHEET_API_TOKEN 이 없습니다.');
    const hit = cache.get(query);
    if (hit && Date.now() - hit.at <= 5 * 60_000) return hit.data;
    const res = await fetch(`${url}?token=${encodeURIComponent(token)}${query}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`시트 읽기 실패: ${res.status}`);
    const data = await res.json();
    if (data.error || !check(data)) throw new Error(`시트 읽기 실패: ${data.error ?? '응답 형식 오류 (Apps Script 새 버전 배포 확인)'}`);
    cache.set(query, { at: Date.now(), data });
    return data;
}

export async function readSheet() {
    const data = await fetchApi('', (d) => Array.isArray(d.values));
    return { title: data.title as string, ...toRecords(data.values as string[][]) };
}

// 개강설정·목표 탭 원본 값
export async function readGoalTabs() {
    const data = await fetchApi('&action=goals', (d) => Array.isArray(d.settings) && Array.isArray(d.goals));
    return { settings: data.settings as string[][], goals: data.goals as string[][] };
}

// 교사 탭 원본 값
export async function readTeachers() {
    const data = await fetchApi('&action=teachers', (d) => Array.isArray(d.values));
    return data.values as string[][];
}
