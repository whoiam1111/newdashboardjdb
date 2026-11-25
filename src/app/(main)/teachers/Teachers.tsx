'use client';
import { useMemo, useState } from 'react';
import { Alert, Card, Descriptions, Empty, Input, Table, Tag } from 'antd';
import { IdcardOutlined, PieChartOutlined, SearchOutlined } from '@ant-design/icons';
import { CardTitle } from '../../ui';
import type { ColumnsType } from 'antd/es/table';
import { PROFILE_COLS, type TeacherView } from '@/lib/teachers';

const GRADES = ['상', '중', '하'];
const TYPES = ['정교사', '교사', '예비교사'];
// 등급 표시는 글자와 함께 (색만으로 구분하지 않음)
const GRADE_COLOR: Record<string, string> = { 상: 'purple', 중: 'blue', 하: 'default' };
const cmp = (a = '', b = '') => a.localeCompare(b, 'ko', { numeric: true });
// 필터 목록: 값이 있는 것 + 빈칸
const filterOf = (list: TeacherView[], col: string, order: string[] = []) => {
    const values = [...new Set(list.map((t) => t.row[col] || '(없음)'))].sort((a, b) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || cmp(a, b);
    });
    return { filters: values.map((v) => ({ text: v, value: v })), onFilter: (v: unknown, t: TeacherView) => (t.row[col] || '(없음)') === v };
};

export default function Teachers({ teachers, duplicates }: { teachers: TeacherView[]; duplicates: number }) {
    const [q, setQ] = useState('');
    const shown = useMemo(
        () => (q ? teachers.filter((t) => [t.row.이름, t.row.지역, t.row.팀, ...t.담당].some((v) => v?.includes(q))) : teachers),
        [q, teachers],
    );
    if (!teachers.length) return <Empty description="교사 탭이 비어 있습니다. 시트의 교사 탭에 교사를 넣어주세요." />;

    // 지역별 요약 (jdb 교사 평가 화면의 지역별 진행)
    const regions = [...new Set(teachers.map((t) => t.row.지역 || '(없음)'))];
    const summary = regions.map((region) => {
        const list = teachers.filter((t) => (t.row.지역 || '(없음)') === region);
        const n = (f: (t: TeacherView) => boolean) => list.filter(f).length;
        return {
            region,
            교사: list.length,
            상: n((t) => t.row.등급 === '상'),
            중: n((t) => t.row.등급 === '중'),
            하: n((t) => t.row.등급 === '하'),
            활동: n((t) => t.활동),
            프로필: n((t) => t.프로필),
        };
    });

    const columns: ColumnsType<TeacherView> = [
        { title: '지역', dataIndex: ['row', '지역'], ...filterOf(teachers, '지역'), sorter: (a, b) => cmp(a.row.지역, b.row.지역) },
        { title: '팀', dataIndex: ['row', '팀'], sorter: (a, b) => cmp(a.row.팀, b.row.팀) },
        { title: '이름', dataIndex: ['row', '이름'], sorter: (a, b) => cmp(a.row.이름, b.row.이름) },
        { title: '교사형태', dataIndex: ['row', '교사형태'], ...filterOf(teachers, '교사형태', TYPES) },
        {
            title: '등급',
            dataIndex: ['row', '등급'],
            ...filterOf(teachers, '등급', GRADES),
            render: (g: string) => (
                <Tag bordered={false} color={GRADE_COLOR[g]}>
                    {g}
                </Tag>
            ),
        },
        { title: '평가항목', dataIndex: ['row', '평가항목'] },
        {
            title: '담당 학생',
            render: (_, t) => t.담당.length,
            sorter: (a, b) => a.담당.length - b.담당.length,
            align: 'right',
        },
        {
            title: '활동',
            render: (_, t) =>
                t.활동 ? (
                    <Tag bordered={false} color="green">
                        활동
                    </Tag>
                ) : (
                    <span style={{ color: 'var(--muted)' }}>비활동</span>
                ),
            filters: [{ text: '활동', value: true }, { text: '비활동', value: false }],
            onFilter: (v, t) => t.활동 === v,
        },
        {
            title: '프로필',
            render: (_, t) => (t.프로필 ? '입력' : <span style={{ color: 'var(--muted)' }}>없음</span>),
            filters: [{ text: '입력', value: true }, { text: '없음', value: false }],
            onFilter: (v, t) => t.프로필 === v,
        },
    ];

    return (
        <div className="stack">
            {duplicates > 0 && (
                <Alert
                    type="warning"
                    showIcon
                    message={`시트 교사 탭에 같은 교사가 겹친 줄이 ${duplicates}줄 있습니다. 화면에는 한 명으로 합쳐 보여줍니다. 시트에서 데이터 → 데이터 정리 → 중복 항목 삭제(고유번호 열)로 정리해 주세요.`}
                />
            )}
            <Card title={<CardTitle icon={<PieChartOutlined />}>지역별 교사 현황</CardTitle>}>
                <Table
                    rowKey="region"
                    size="small"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    dataSource={summary}
                    columns={[
                        { title: '지역', dataIndex: 'region' },
                        ...['교사', '상', '중', '하', '활동', '프로필'].map((c) => ({ title: c, dataIndex: c, align: 'right' as const })),
                    ]}
                />
            </Card>
            <Card
                title={<CardTitle icon={<IdcardOutlined />}>교사 관리 {shown.length}명</CardTitle>}
                extra={
                    <Input
                        prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
                        placeholder="이름·지역·담당 학생 검색"
                        allowClear
                        onChange={(e) => setQ(e.target.value)}
                        style={{ width: 240 }}
                        aria-label="검색"
                    />
                }
            >
                <Table
                    rowKey="key"
                    size="small"
                    dataSource={shown}
                    columns={columns}
                    scroll={{ x: 'max-content' }}
                    pagination={{ defaultPageSize: 50, showSizeChanger: true }}
                    expandable={{
                        expandedRowRender: (t) => (
                            <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered>
                                <Descriptions.Item label="담당 학생" span={3}>
                                    {t.담당.length ? t.담당.join(', ') : '없음'}
                                </Descriptions.Item>
                                <Descriptions.Item label="평가일">{t.row.평가일 || '-'}</Descriptions.Item>
                                {PROFILE_COLS.map((c) => (
                                    <Descriptions.Item key={c} label={c}>
                                        {t.row[c] || '-'}
                                    </Descriptions.Item>
                                ))}
                                {t.row.메모 && (
                                    <Descriptions.Item label="메모" span={3}>
                                        {t.row.메모}
                                    </Descriptions.Item>
                                )}
                            </Descriptions>
                        ),
                    }}
                />
            </Card>
        </div>
    );
}
