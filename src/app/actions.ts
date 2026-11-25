'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
    authenticate,
    hashPassword,
    lockedMinutes,
    newPasswordError,
    recordLogin,
    REGION_IDS,
    sheetStore,
} from '@/lib/accounts';
import { requireUser, setSessionCookie } from '@/lib/user';

export async function login(_: string | null, form: FormData) {
    const id = String(form.get('id') ?? '').trim();
    const locked = lockedMinutes(id);
    if (locked) return `로그인 시도가 너무 많습니다. ${locked}분 뒤에 다시 시도해주세요.`;
    let user;
    try {
        user = await authenticate(id, String(form.get('password') ?? ''));
    } catch (e) {
        // 로그인 전 사용자에게는 내부 설정·오류 내용을 보여주지 않는다
        console.error('login:', (e as Error).message);
        return '지금은 로그인할 수 없습니다. 관리자에게 문의해주세요.';
    }
    recordLogin(id, !!user);
    if (!user) return '아이디 또는 비밀번호가 올바르지 않습니다.';
    await setSessionCookie(user);
    redirect(user.mustChange ? '/password' : '/');
}

export async function logout() {
    (await cookies()).delete('session');
    redirect('/login');
}

// 내 비밀번호 바꾸기 (처음 로그인 때 필수). 현재 비밀번호를 다시 확인한다
export async function changeMyPassword(_: string | null, form: FormData) {
    const user = await requireUser({ allowMustChange: true });
    const next = String(form.get('next') ?? '');
    const error = newPasswordError(next, String(form.get('confirm') ?? ''));
    if (error) return error;
    try {
        if (!(await authenticate(user.id, String(form.get('current') ?? '')))) return '현재 비밀번호가 올바르지 않습니다.';
        await sheetStore.set(user.id, hashPassword(next));
    } catch (e) {
        return (e as Error).message;
    }
    await setSessionCookie({ ...user, mustChange: false });
    redirect('/');
}

// 관리자(jdb)가 지역 계정 비밀번호를 바꾼다
type Result = { ok: boolean; message: string } | null;
export async function setRegionPassword(_: Result, form: FormData): Promise<Result> {
    const user = await requireUser();
    if (user.region) return { ok: false, message: '관리자만 바꿀 수 있습니다.' };
    const id = String(form.get('id') ?? '');
    if (!REGION_IDS.includes(id)) return { ok: false, message: '없는 계정입니다.' };
    const next = String(form.get('next') ?? '');
    const error = newPasswordError(next, next);
    if (error) return { ok: false, message: error };
    try {
        await sheetStore.set(id, hashPassword(next));
    } catch (e) {
        return { ok: false, message: (e as Error).message };
    }
    revalidatePath('/accounts');
    return { ok: true, message: `${id} 비밀번호를 바꿨습니다.` };
}
