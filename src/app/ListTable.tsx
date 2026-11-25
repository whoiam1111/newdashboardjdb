'use client';
import { useMemo, useState } from 'react';
import { Card, Input, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DatabaseOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { CardTitle } from './ui';

type Row = Record<string, string>;

export default function ListTable({
    title,
    headers,
    records,
    current = false,
}: {
    title: string;
    headers: string[];
    records: Row[];
    current?: boolean;
}) {
    const [q, setQ] = useState('');
    const shown = useMemo(
        () => (q ? records.filter((r) => headers.some((h) => r[h]?.includes(q))) : records),
        [q, records, headers],
    );

    const columns: ColumnsType<Row> = headers.map((h) => {
        const values = [...new Set(records.map((r) => r[h]).filter(Boolean))].sort();
        return {
            title: h,
            dataIndex: h,
            sorter: (a, b) => (a[h] ?? '').localeCompare(b[h] ?? ''),
            // 값 종류가 적은 열(상태·지역·팀·도구 등)만 필터 제공
            ...(values.length <= 30 && {
                filters: values.map((v) => ({ text: v, value: v })),
                onFilter: (v, r) => r[h] === v,
            }),
        };
    });

    const counts = new Map<string, number>();
    for (const r of shown) counts.set(r['현재상태'] || '-', (counts.get(r['현재상태'] || '-') ?? 0) + 1);

    return (
        <Card
            title={<CardTitle icon={current ? <TeamOutlined /> : <DatabaseOutlined />}>{title}</CardTitle>}
            extra={
                <Input
                    prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
                    placeholder="이름·지역·인도자 검색"
                    allowClear
                    onChange={(e) => setQ(e.target.value)}
                    style={{ width: 240 }}
                    aria-label="검색"
                />
            }
        >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                <Tag color="purple" bordered={false}>
                    전체 {shown.length.toLocaleString()}
                </Tag>
                {[...counts]
                    .sort((a, b) => b[1] - a[1])
                    .map(([s, n]) => (
                        <Tag key={s} bordered={false}>
                            {s} {n.toLocaleString()}
                        </Tag>
                    ))}
            </div>
            <Table
                rowKey="key"
                size="small"
                columns={columns}
                dataSource={shown}
                scroll={{ x: 'max-content' }}
                pagination={{ defaultPageSize: 50, showSizeChanger: true }}
            />
        </Card>
    );
}
