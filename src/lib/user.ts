import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signSession, verifySession, type User } from './session';

// 로그인 안 했으면 로그인 화면, 처음 비밀번호 그대로면 비밀번호 변경 화면으로
export async function requireUser({ allowMustChange = false } = {}) {
    const user = await verifySession((await cookies()).get('session')?.value);
    if (!user) redirect('/login');
    if (user.mustChange && !allowMustChange) redirect('/password');
    return user;
}

export async function setSessionCookie(user: User) {
    (await cookies()).set('session', await signSession(user), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 12,
    });
}
