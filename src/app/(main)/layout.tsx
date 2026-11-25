import { requireUser } from '@/lib/user';
import Sidebar from './Sidebar';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
    const user = await requireUser();
    const label = user.region ? `${user.region} 지역` : '전체 (관리자)';
    const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long' });
    return (
        <div className="app">
            <Sidebar id={user.id} label={label} isAdmin={!user.region} />
            <main className="content">
                <header className="page-head">
                    <span className="avatar">{user.id.slice(0, 1).toUpperCase()}</span>
                    <div>
                        <h1>{label}</h1>
                        <p>{today} · 오늘도 수고 많으십니다</p>
                    </div>
                </header>
                {children}
            </main>
        </div>
    );
}
