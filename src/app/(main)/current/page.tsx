import { forUser, isDropped } from '@/lib/dashboard';
import { readSheet } from '@/lib/sheet';
import { requireUser } from '@/lib/user';
import ListTable from '../../ListTable';

export default async function CurrentPage() {
    const user = await requireUser();
    const { headers, records } = await readSheet();
    return <ListTable current title="현재명단 (탈락 제외)" headers={headers} records={forUser(records, user).filter((r) => !isDropped(r))} />;
}
