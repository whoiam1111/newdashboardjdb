'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Empty, Progress, Segmented, Select, Table } from 'antd';
import { AimOutlined, ApartmentOutlined } from '@ant-design/icons';
import { CardTitle } from '../../ui';
import { STEPS, type Campaign, type GoalRow, type Step } from '@/lib/goals';

const pct = (a: number, g: number) => (g > 0 ? Math.round((a / g) * 100) : null);
const fmt = (n: number) => String(Math.round(n * 10) / 10);

type Line = GoalRow & { key: string; isTotal?: boolean };

// 지역마다 팀 줄 + 지역 합계 줄
function withTotals(rows: GoalRow[]): Line[] {
    const out: Line[] = [];
    const regions = [...new Set(rows.map((r) => r.region))];
    for (const region of regions) {
        const teams = rows.filter((r) => r.region === region);
        const sum = (k: 'goal' | 'actual') =>
            Object.fromEntries(STEPS.map((s) => [s, teams.reduce((a, t) => a + t[k][s], 0)])) as Record<Step, number>;
        out.push(...teams.map((t) => ({ ...t, key: `${region}|${t.team}` })));
        out.push({ region, team: '합계', goal: sum('goal'), actual: sum('actual'), key: `${region}|합계`, isTotal: true });
    }
    return out;
}

export default function Goals({
    months,
    campaign,
    rows,
    myRegion,
}: {
    months: string[];
    campaign: Campaign | null;
    rows: GoalRow[];
    myRegion: string | null;
}) {
    const router = useRouter();
    const [scope, setScope] = useState<'mine' | 'all'>(myRegion ? 'mine' : 'all');
    const shown = useMemo(() => withTotals(scope === 'mine' && myRegion ? rows.filter((r) => r.region === myRegion) : rows), [rows, scope, myRegion]);
    if (!campaign) return <Empty description="개강설정 탭에 개강이 없습니다. 시트에서 개강월·1주차시작일·주차수를 넣어주세요." />;

    const totals = shown.filter((l) => l.isTotal);
    const sum = (k: 'goal' | 'actual', s: Step) => totals.reduce((a, t) => a + t[k][s], 0);
    const [y, m] = campaign.month.split('-');

    return (
        <div className="stack">
            <Card
                title={<CardTitle icon={<AimOutlined />}>{`${y}년 ${Number(m)}월 개강 목표 달성`}</CardTitle>}
                extra={
                    <div style={{ display: 'flex', gap: 8 }}>
                        {myRegion && (
                            <Segmented
                                value={scope}
                                onChange={(v) => setScope(v as 'mine' | 'all')}
                                options={[
                                    { value: 'mine', label: `${myRegion}` },
                                    { value: 'all', label: '전체 지역' },
                                ]}
                            />
                        )}
                        <Select
                            value={campaign.month}
                            onChange={(v) => router.push(`/goals?month=${v}`)}
                            options={months.map((mo) => ({ value: mo, label: `${mo.slice(0, 4)}년 ${Number(mo.slice(5))}월` }))}
                            style={{ width: 130 }}
                            aria-label="개강월"
                        />
                    </div>
                }
            >
                <p className="hint">
                    개강 기간 {campaign.start} ~ {campaign.end} ({campaign.weeks}주) · 발·찾 인정 {campaign.start} ~ {campaign.balEnd}
                </p>
                <div className="tiles wide">
                    {STEPS.map((s) => {
                        const p = pct(sum('actual', s), sum('goal', s));
                        return (
                            <div key={s} className="tile">
                                <div className="tile-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{s}</span>
                                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{p === null ? '-' : `${p}%`}</span>
                                </div>
                                <div className="tile-value">
                                    {fmt(sum('actual', s))}
                                    <small>/ {fmt(sum('goal', s))}</small>
                                </div>
                                <Progress
                                    percent={Math.min(100, p ?? 0)}
                                    showInfo={false}
                                    size="small"
                                    strokeColor="var(--primary)"
                                    trailColor="var(--primary-soft)"
                                    aria-label={`${s} 달성률`}
                                />
                            </div>
                        );
                    })}
                </div>
            </Card>
            <Card title={<CardTitle icon={<ApartmentOutlined />}>지역·팀별 실적 / 목표</CardTitle>}>
                <Table<Line>
                    rowKey="key"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    dataSource={shown}
                    onRow={(l) => (l.isTotal ? { style: { background: 'var(--soft)', fontWeight: 600 } } : {})}
                    columns={[
                        { title: '지역', dataIndex: 'region', fixed: 'left' },
                        { title: '팀', dataIndex: 'team', render: (t: string, l) => (l.isTotal ? t : t === '사랑' ? t : `${t}팀`) },
                        ...STEPS.map((s) => ({
                            title: s,
                            align: 'right' as const,
                            render: (_: unknown, l: Line) => {
                                const p = pct(l.actual[s], l.goal[s]);
                                return (
                                    <span style={{ whiteSpace: 'nowrap' }}>
                                        {fmt(l.actual[s])} / {fmt(l.goal[s])}
                                        {p !== null && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>{p}%</span>}
                                    </span>
                                );
                            },
                        })),
                    ]}
                />
            </Card>
        </div>
    );
}
