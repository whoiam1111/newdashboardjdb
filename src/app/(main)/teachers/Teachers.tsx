'use client';
import { useMemo, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Input, Space, Switch, Table, Tag } from 'antd';
import { IdcardOutlined, PieChartOutlined, SearchOutlined } from '@ant-design/icons';
import { CardTitle } from '../../ui';
import type { ColumnsType } from 'antd/es/table';
import { PROFILE_COLS, type TeacherView } from '@/lib/teachers';

const GRADES = ['상', '중', '하'];
const TYPES = ['정교사', '교사', '예비교사'];
// 등급 표시는 글자와 함께 (색만으로 구분하지 않음)
const GRADE_COLOR: Record<string, string> = { 상: 'purple', 중: 'blue', 하: 'default' };
// 프로필에서 따로 보여주는 칸. 교사 탭의 나머지 칸은 '기타'에 모아 빠짐없이 보여준다
const SHOWN = new Set(['고유번호', '지역', '팀', '이름', '교사형태', '등급', '평가항목', '평가일', '메모', ...PROFILE_COLS]);
// 값 종류가 적어 표에서 거르기 좋은 프로필 칸
const FILTER_COLS = ['성별', '종교', 'MBTI', '에니어그램'];
const cmp = (a = '', b = '') => a.localeCompare(b, 'ko', { numeric: true });
// 필터 목록: 값이 있는 것 + 빈칸
const filterOf = (list: TeacherView[], col: string, order: string[] = []) => {
    const values = [...new Set(list.map((t) => t.row[col] || '(없음)'))].sort((a, b) => {
        const ia = order.indexOf(a), ib = order.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || cmp(a, b);
    });
    return { filters: values.map((v) => ({ text: v, value: v })), onFilter: (v: unknown, t: TeacherView) => (t.row[col] || '(없음)') === v };
};

// 교사 한 명의 프로필 (이름 또는 줄을 누르면 오른쪽에 열림)
function Profile({ t }: { t: TeacherView }) {
    const r = t.row;
    const extra = Object.entries(r).filter(([k, v]) => k && v && !SHOWN.has(k));
    const item = (label: string, value?: string) => (
        <Descriptions.Item key={label} label={label}>
            {value || <span style={{ color: 'var(--muted)' }}>-</span>}
        </Descriptions.Item>
    );
    return (
        <div className="stack">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>
                    {r.이름.slice(0, 1)}
                </span>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{r.이름}</div>
                    <div style={{ color: 'var(--sub)' }}>
                        {r.지역} {r.팀 && `${r.팀}팀`} · {r.교사형태 || '형태 없음'}
                    </div>
                    <div style={{ marginTop: 6 }}>
                        <Tag bordered={false} color={GRADE_COLOR[r.등급]}>
                            등급 {r.등급}
                        </Tag>
                        {t.활동 ? (
                            <Tag bordered={false} color="green">
                                활동 · 담당 {t.담당.length}명
                            </Tag>
                        ) : (
                            <Tag bordered={false}>비활동</Tag>
                        )}
                    </div>
                </div>
            </div>
            <Descriptions size="small" column={1} bordered title="평가">
                {item('평가항목', r.평가항목)}
                {item('평가일', r.평가일)}
            </Descriptions>
            {t.프로필 ? (
                <Descriptions size="small" column={1} bordered title="프로필">
                    {PROFILE_COLS.map((c) => item(c, r[c]))}
                </Descriptions>
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="프로필이 없습니다. 시트 교사 탭에서 입력해 주세요." />
            )}
            <Descriptions size="small" column={1} bordered title="담당 학생 (합 이상)">
                <Descriptions.Item label={`${t.담당.length}명`}>
                    {t.담당.length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {t.담당.map((s) => (
                                <Tag key={s} bordered={false}>
                                    {s}
                                </Tag>
                            ))}
                        </div>
                    ) : (
                        <span style={{ color: 'var(--muted)' }}>없음</span>
                    )}
                </Descriptions.Item>
            </Descriptions>
            {extra.length > 0 && (
                <Descriptions size="small" column={1} bordered title="기타">
                    {extra.map(([k, v]) => item(k, v))}
                </Descriptions>
            )}
            {r.메모 && (
                <Descriptions size="small" column={1} bordered title="메모">
                    <Descriptions.Item label="메모">{r.메모}</Descriptions.Item>
                </Descriptions>
            )}
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>고유번호 {r.고유번호 || '-'}</div>
        </div>
    );
}

export default function Teachers({ teachers, duplicates }: { teachers: TeacherView[]; duplicates: number }) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState<TeacherView | null>(null);
    const [showProfile, setShowProfile] = useState(false);
    const shown = useMemo(
        () =>
            q
                ? teachers.filter((t) => [t.row.이름, t.row.지역, t.row.팀, ...PROFILE_COLS.map((c) => t.row[c]), ...t.담당].some((v) => v?.includes(q)))
                : teachers,
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
        {
            title: '이름',
            dataIndex: ['row', '이름'],
            sorter: (a, b) => cmp(a.row.이름, b.row.이름),
            render: (name: string, t) => (
                <Button type="link" size="small" style={{ padding: 0, fontWeight: 600 }} onClick={() => setOpen(t)}>
                    {name}
                </Button>
            ),
        },
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
        // 프로필 칸 보기를 켜면, 한 명이라도 값이 있는 프로필 칸을 표에 붙인다
        ...(showProfile ? PROFILE_COLS.filter((c) => teachers.some((t) => t.row[c])) : []).map((c) => ({
            title: c,
            dataIndex: ['row', c],
            ...(FILTER_COLS.includes(c) ? filterOf(teachers, c) : {}),
            sorter: (a: TeacherView, b: TeacherView) => cmp(a.row[c], b.row[c]),
            ellipsis: true,
        })),
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
                    <Space wrap>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <Switch size="small" checked={showProfile} onChange={setShowProfile} />
                            프로필 칸 보기
                        </label>
                        <Input
                            prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
                            placeholder="이름·지역·프로필·담당 학생 검색"
                            allowClear
                            onChange={(e) => setQ(e.target.value)}
                            style={{ width: 260 }}
                            aria-label="검색"
                        />
                    </Space>
                }
            >
                <Table
                    rowKey="key"
                    size="small"
                    dataSource={shown}
                    columns={columns}
                    scroll={{ x: 'max-content' }}
                    pagination={{ defaultPageSize: 50, showSizeChanger: true }}
                    onRow={(t) => ({ onClick: () => setOpen(t), style: { cursor: 'pointer' } })}
                />
            </Card>
            <Drawer open={!!open} onClose={() => setOpen(null)} width="min(460px, 100vw)" title="교사 프로필">
                {open && <Profile t={open} />}
            </Drawer>
        </div>
    );
}
