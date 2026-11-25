import { forUser } from '@/lib/dashboard';
import { readSheet } from '@/lib/sheet';
import { requireUser } from '@/lib/user';
import ListTable from '../../ListTable';

export default async function ListPage() {
    const user = await requireUser();
    const { title, headers, records } = await readSheet();
    // 지역 계정에는 자기 지역 사람만 보낸다
    return <ListTable title={title} headers={headers} records={forUser(records, user)} />;
}
