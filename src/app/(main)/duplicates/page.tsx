import { findDuplicates } from '@/lib/dashboard';
import { readSheet } from '@/lib/sheet';
import { requireUser } from '@/lib/user';
import Duplicates from './Duplicates';

export default async function DuplicatesPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
    const user = await requireUser();
    const includeDropped = (await searchParams).all === '1';
    const { records } = await readSheet();
    // 전체 명단에서 묶어야 다른 지역 줄과 비교된다. 범위 제한은 findDuplicates 안에서
    return <Duplicates groups={findDuplicates(records, user, includeDropped)} includeDropped={includeDropped} />;
}
