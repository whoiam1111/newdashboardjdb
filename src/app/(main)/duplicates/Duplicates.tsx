'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Segmented, Table, Tag } from 'antd';
import { CopyOutlined, SearchOutlined } from '@ant-design/icons';
import { DUP_COLS, isDropped, type DupGroup } from '@/lib/dashboard';
import { CardTitle } from '../../ui';

export default function Duplicates({ groups, includeDropped }: { groups: DupGroup[]; includeDropped: boolean }) {
    const router = useRouter();
    const [q, setQ] = useState('');
    const shown = useMemo(() => (q ? groups.filter((g) => g.이름.includes(q) || g.지역.some((r) => r.includes(q))) : groups), [q, groups]);
    return (
        <Card
            title={<CardTitle icon={<CopyOutlined />}>다른 지역 중복 {shown.length}건</CardTitle>}
            extra={
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Segmented
                        value={includeDropped ? 'all' : 'current'}
                        onChange={(v) => router.push(v === 'all' ? '/duplicates?all=1' : '/duplicates')}
                        options={[
                            { value: 'current', label: '진행 중인 사람 있는 것' },
                            { value: 'all', label: '탈락끼리도' },
                        ]}
                    />
                    <Input
                        prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
                        placeholder="이름·지역 검색"
                        allowClear
                        onChange={(e) => setQ(e.target.value)}
                        style={{ width: 200 }}
                        aria-label="검색"
                    />
                </div>
            }
        >
            <p className="hint">
                이름과 연락처 뒷4자리가 같은데 인도자 지역이 다른 사람들입니다. 최근 날짜 순이며, 한 명이라도 진행 중(발·찾 등)이면 탈락한 줄도 함께 보여줍니다. 연락처가 없는 사람은 비교하지 않습니다.
            </p>
            <Table
                rowKey="key"
                size="small"
                dataSource={shown}
                pagination={{ defaultPageSize: 50, showSizeChanger: true }}
                columns={[
                    { title: '최근날짜', dataIndex: '최근날짜' },
                    { title: '이름', dataIndex: '이름' },
                    { title: '연락처 뒷4자리', dataIndex: '연락처' },
                    { title: '지역', render: (_, g) => g.지역.map((r) => (
                            <Tag key={r} bordered={false}>
                                {r}
                            </Tag>
                        )) },
                    { title: '건수', render: (_, g) => g.rows.length, align: 'right' },
                ]}
                expandable={{
                    expandedRowRender: (g) => (
                        <Table
                            rowKey="번호"
                            size="small"
                            pagination={false}
                            scroll={{ x: 'max-content' }}
                            dataSource={g.rows}
                            columns={[
                                ...DUP_COLS.map((c) =>
                                    c === '현재상태'
                                        ? {
                                              title: c,
                                              dataIndex: c,
                                              render: (v: string) => (
                                                  <Tag bordered={false} color={isDropped({ 현재상태: v }) ? 'red' : 'green'}>
                                                      {v || '-'}
                                                  </Tag>
                                              ),
                                          }
                                        : { title: c, dataIndex: c },
                                ),
                                { title: '최근날짜', dataIndex: '최근날짜' },
                            ]}
                        />
                    ),
                }}
            />
        </Card>
    );
}
