import { redirect } from 'next/navigation';
import { REGION_IDS, sheetStore } from '@/lib/accounts';
import { requireUser } from '@/lib/user';
import AccountsTable from './AccountsTable';

export default async function AccountsPage() {
    const user = await requireUser();
    if (user.region) redirect('/');
    const stored = await sheetStore.list();
    const rows = REGION_IDS.map((id) => {
        const s = stored.find((a) => a.id === id);
        return { id, changed: !!s, updatedAt: s?.updatedAt ?? '' };
    });
    return <AccountsTable rows={rows} />;
}
