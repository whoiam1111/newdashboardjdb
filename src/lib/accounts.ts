import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { User } from './session';

export const ADMIN_ID = 'jdb';
export const REGION_IDS = ['도봉', '노원', '성북', '중랑', '강북', '대학', '새신자', '이음'];
export const ACCOUNT_IDS = [ADMIN_ID, ...REGION_IDS];
export const MIN_PASSWORD = 8;
// 비밀번호를 한 번도 안 바꾼 계정은 .env 의 INITIAL_PASSWORD 로 들어오고, 들어오자마자 바꿔야 한다
// 코드가 공개 저장소에 있으므로 처음 비밀번호를 코드에 두지 않는다. 없거나 8자 미만이면 처음 비밀번호 로그인을 막는다
const initialPassword = () => {
    const p = process.env.INITIAL_PASSWORD ?? '';
    return p.length >= MIN_PASSWORD ? p : null;
};

export const hashPassword = (pw: string) => {
    const salt = randomBytes(16).toString('hex');
    return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString('hex')}`;
};

export function verifyHash(pw: string, stored: string) {
    const [kind, salt, hex] = stored.split('$');
    if (kind !== 'scrypt' || !salt || !hex) return false;
    const a = scryptSync(pw, salt, 32);
    const b = Buffer.from(hex, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
}

export type Stored = { id: string; hash: string; updatedAt: string };
export type Store = { list(): Promise<Stored[]>; set(id: string, hash: string): Promise<void> };

// 비밀번호 해시는 시트의 숨김 '계정' 탭에 (apps-script/api.gs)
async function callApi(init?: RequestInit, query = '') {
    const url = process.env.SHEET_API_URL;
    const token = process.env.SHEET_API_TOKEN;
    if (!url || !token) throw new Error('SHEET_API_URL / SHEET_API_TOKEN 이 없습니다.');
    const res = await fetch(init ? url : `${url}?token=${encodeURIComponent(token)}${query}`, { cache: 'no-store', ...init });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = { error: `JSON 이 아닌 응답 (HTTP ${res.status})` };
    }
    if (!res.ok || data.error) throw new Error(`계정 저장소 오류: ${data.error ?? `HTTP ${res.status}`}`);
    return data;
}

const OLD_DEPLOY = 'Apps Script 가 예전 버전입니다. api.gs 를 바꾼 뒤 배포 관리 → 수정 → 새 버전으로 다시 배포하세요.';

export const sheetStore: Store = {
    // 목록이 이상하면 '저장된 비밀번호 없음'으로 보지 않는다 (그러면 처음 비밀번호로 다시 들어와짐)
    list: async () => {
        const data = await callApi(undefined, '&action=accounts');
        if (!Array.isArray(data.accounts)) throw new Error(OLD_DEPLOY);
        return data.accounts;
    },
    set: async (id, hash) => {
        const data = await callApi({
            method: 'POST',
            headers: { 'content-type': 'text/plain' },
            body: JSON.stringify({ token: process.env.SHEET_API_TOKEN, action: 'setPassword', id, hash }),
        });
        if (data.ok !== true) throw new Error(OLD_DEPLOY);
    },
};

export async function authenticate(id: string, pw: string, store: Store = sheetStore): Promise<User | null> {
    const name = id.trim();
    if (!ACCOUNT_IDS.includes(name) || !pw) return null;
    const stored = (await store.list()).find((a) => a.id === name);
    const init = initialPassword();
    const ok = stored ? verifyHash(pw, stored.hash) : !!init && pw === init;
    if (!ok) return null;
    return { id: name, region: name === ADMIN_ID ? null : name, mustChange: !stored };
}

// 새 비밀번호 검사. 문제가 있으면 안내 문구
export function newPasswordError(pw: string, confirm: string) {
    if (pw.length < MIN_PASSWORD) return `비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`;
    if (pw === initialPassword() || pw === 'jdb1234') return '처음 비밀번호는 다시 쓸 수 없습니다.';
    if (pw !== confirm) return '새 비밀번호와 확인이 다릅니다.';
    return null;
}

// 같은 아이디로 5번 틀리면 10분 잠금
// shortcut: 서버 메모리에만 기록, 서버가 여러 대거나 재시작하면 초기화. 공개 배포 규모가 커지면 저장소로 옮기기
const fails = new Map<string, { n: number; until: number }>();
export const lockedMinutes = (id: string, now = Date.now()) => {
    const f = fails.get(id);
    return f && f.n >= 5 && f.until > now ? Math.ceil((f.until - now) / 60_000) : 0;
};
export const recordLogin = (id: string, ok: boolean, now = Date.now()) => {
    if (!ACCOUNT_IDS.includes(id)) return; // 아무 아이디나 보내 메모리를 채우지 못하게
    if (ok) return void fails.delete(id);
    const f = fails.get(id);
    const n = f && f.until > now ? f.n + 1 : 1;
    fails.set(id, { n, until: now + 10 * 60_000 });
};
