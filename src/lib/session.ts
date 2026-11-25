import { SignJWT, jwtVerify } from 'jose';

const secret = () => {
    const s = process.env.SESSION_SECRET;
    if (!s || s.length < 32) throw new Error('SESSION_SECRET 가 없거나 32자 미만입니다.');
    return new TextEncoder().encode(s);
};

// region 이 null 이면 전체(관리자 jdb), 아니면 그 지역 계정. mustChange: 처음 비밀번호로 들어와 바꿔야 함
export type User = { id: string; region: string | null; mustChange: boolean };

export const signSession = (u: User) =>
    new SignJWT({ id: u.id, region: u.region, mustChange: u.mustChange })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('12h')
        .sign(secret());

export async function verifySession(token: string | undefined): Promise<User | null> {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secret());
        if (typeof payload.id !== 'string') return null;
        return {
            id: payload.id,
            region: typeof payload.region === 'string' ? payload.region : null,
            mustChange: payload.mustChange === true,
        };
    } catch {
        return null;
    }
}
