import { forUser, isDropped } from '@/lib/dashboard';
import { readSheet, readTeachers } from '@/lib/sheet';
import { buildTeachers } from '@/lib/teachers';
import { requireUser } from '@/lib/user';
import Teachers from './Teachers';

export default async function TeachersPage() {
    const user = await requireUser();
    const [{ records }, values] = await Promise.all([readSheet(), readTeachers()]);
    const { teachers, duplicates } = buildTeachers(values, records, user);
    // 교사가 아직 안 붙은 진행 중 학생 (매칭 찾기에서 고른다)
    const students = forUser(records as Record<string, string>[], user)
        .filter((r) => !isDropped(r) && !r.교사이름)
        .map((r) => ({ key: r.key, 이름: r.이름, 성별: r.성별 ?? '', 생년: r.생년 ?? '', 지역: r.인도자지역 ?? '', 현재상태: r.현재상태 ?? '' }));
    return <Teachers teachers={teachers} duplicates={duplicates} students={students} />;
}
