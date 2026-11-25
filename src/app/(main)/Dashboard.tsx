'use client';
import Link from 'next/link';
import { Button, Card, Table } from 'antd';
import { BarChartOutlined, CalendarOutlined, TeamOutlined } from '@ant-design/icons';
import { STAGES, type Summary } from '@/lib/dashboard';
import { CardTitle, Tile } from '../ui';

export default function Dashboard({ month, summary }: { month: string; summary: Summary }) {
    return (
        <div className="stack">
            <div className="grid-2">
                <Card
                    title={<CardTitle icon={<TeamOutlined />}>진행 중</CardTitle>}
                    extra={
                        <Link href="/current">
                            <Button size="small">명단 보기</Button>
                        </Link>
                    }
                >
                    <p className="lead">
                        <strong>{summary.total.toLocaleString()}</strong>명이 진행 중입니다
                    </p>
                    <div className="tiles">
                        {STAGES.map((s) => (
                            <Tile key={s} label={s} value={summary.byStage[s]} suffix="명" />
                        ))}
                    </div>
                </Card>
                <Card
                    title={<CardTitle icon={<CalendarOutlined />}>{Number(month.slice(5))}월 실적</CardTitle>}
                    extra={
                        <Link href="/goals">
                            <Button size="small">목표 달성</Button>
                        </Link>
                    }
                >
                    <p className="lead">이번 달에 단계가 바뀐 인원입니다</p>
                    <div className="tiles two">
                        {Object.entries(summary.month).map(([k, v]) => (
                            <Tile key={k} label={k} value={v} suffix="명" />
                        ))}
                    </div>
                </Card>
            </div>
            <Card title={<CardTitle icon={<BarChartOutlined />}>{summary.groupBy}별 진행 중</CardTitle>}>
                <Table
                    rowKey="name"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    dataSource={summary.groups}
                    columns={[
                        { title: summary.groupBy, dataIndex: 'name', fixed: 'left' },
                        { title: '합계', dataIndex: 'total', align: 'right', sorter: (a, b) => a.total - b.total },
                        ...STAGES.map((s) => ({
                            title: s,
                            dataIndex: s,
                            align: 'right' as const,
                            render: (v: number) => v || <span style={{ color: 'var(--muted)' }}>-</span>,
                        })),
                    ]}
                />
            </Card>
        </div>
    );
}
