import { readSheet, readTeachers } from '@/lib/sheet';
import { buildTeachers } from '@/lib/teachers';
import { requireUser } from '@/lib/user';
import Teachers from './Teachers';

export default async function TeachersPage() {
    const user = await requireUser();
    const [{ records }, values] = await Promise.all([readSheet(), readTeachers()]);
    const { teachers, duplicates } = buildTeachers(values, records, user);
    return <Teachers teachers={teachers} duplicates={duplicates} />;
}
