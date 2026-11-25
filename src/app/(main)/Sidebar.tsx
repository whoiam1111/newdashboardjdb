'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    AimOutlined,
    AppstoreOutlined,
    CopyOutlined,
    DatabaseOutlined,
    IdcardOutlined,
    KeyOutlined,
    LockOutlined,
    LogoutOutlined,
    StarFilled,
    TeamOutlined,
} from '@ant-design/icons';
import { logout } from '../actions';

const MAIN = [
    { href: '/', label: '대시보드', icon: <AppstoreOutlined /> },
    { href: '/current', label: '현재명단', icon: <TeamOutlined /> },
    { href: '/list', label: '전체명단', icon: <DatabaseOutlined /> },
    { href: '/goals', label: '목표 달성', icon: <AimOutlined /> },
    { href: '/duplicates', label: '중복 찾기', icon: <CopyOutlined /> },
    { href: '/teachers', label: '교사', icon: <IdcardOutlined /> },
];
const ADMIN = [{ href: '/accounts', label: '계정 관리', icon: <KeyOutlined /> }];

export default function Sidebar({ id, label, isAdmin }: { id: string; label: string; isAdmin: boolean }) {
    const path = usePathname();
    const item = (n: (typeof MAIN)[number]) => (
        <Link key={n.href} href={n.href} className={`nav-item${path === n.href ? ' active' : ''}`} aria-current={path === n.href ? 'page' : undefined}>
            {n.icon}
            {n.label}
        </Link>
    );
    return (
        <nav className="sidebar" aria-label="메뉴">
            <div className="brand">
                <span className="brand-mark">
                    <StarFilled />
                </span>
                <span>발굴 명단</span>
            </div>
            <div className="nav-label">메뉴</div>
            {MAIN.map(item)}
            {isAdmin && (
                <>
                    <div className="nav-label">관리</div>
                    {ADMIN.map(item)}
                </>
            )}
            <div className="nav-spacer" />
            {item({ href: '/password', label: '비밀번호 변경', icon: <LockOutlined /> })}
            <form action={logout} style={{ display: 'contents' }}>
                <button type="submit" className="nav-item">
                    <LogoutOutlined />
                    로그아웃
                </button>
            </form>
            <div className="user-chip">
                <span className="avatar sm">{id.slice(0, 1).toUpperCase()}</span>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{id}</div>
                    <div style={{ color: 'var(--sub)', fontSize: 12 }}>{label}</div>
                </div>
            </div>
        </nav>
    );
}
