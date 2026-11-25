import { forUser, summarize } from '@/lib/dashboard';
import { readSheet } from '@/lib/sheet';
import { requireUser } from '@/lib/user';
import Dashboard from './Dashboard';

export default async function Home() {
    const user = await requireUser();
    const { records } = await readSheet();
    const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
    // 서버에서 집계해 숫자만 보낸다 (명단 원본은 브라우저로 안 감)
    return <Dashboard month={month} summary={summarize(forUser(records, user), user, month)} />;
}
