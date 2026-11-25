'use client';
import { useMemo, useState } from 'react';
import { Button, Card, Checkbox, Empty, Input, Segmented, Select, Space, Table, Tag } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import { CardTitle } from '../../ui';
import { matchTeachers, type Match, type MatchWant, type TeacherView } from '@/lib/teachers';

// 교사가 아직 없는 진행 중 학생 (고르면 조건이 채워진다)
export type Student = { key: string; 이름: string; 성별: string; 생년: string; 지역: string; 현재상태: string };

export default function MatchFinder({ teachers, students, onOpen }: { teachers: TeacherView[]; students: Student[]; onOpen: (t: TeacherView) => void }) {
    const [want, setWant] = useState<MatchWant>({ 같은성별만: true });
    const set = (p: Partial<MatchWant>) => setWant((w) => ({ ...w, ...p }));
    const regions = useMemo(() => [...new Set(teachers.map((t) => t.row.지역).filter(Boolean))], [teachers]);
    const touched = !!(want.성별 || want.나이 || want.지역 || want.키워드);
    const result = useMemo(() => (touched ? matchTeachers(teachers, want).slice(0, 10) : []), [teachers, want, touched]);

    return (
        <Card title={<CardTitle icon={<AimOutlined />}>교사 매칭 찾기</CardTitle>}>
            <div className="stack">
                <Space wrap>
                    <Select
                        showSearch
                        allowClear
                        placeholder="학생 고르기 (교사 없는 학생)"
                        style={{ width: 240 }}
                        optionFilterProp="label"
                        aria-label="학생"
                        options={students.map((s) => ({ value: s.key, label: `${s.이름} · ${s.지역} · ${s.현재상태}` }))}
                        onChange={(k) => {
                            const s = students.find((x) => x.key === k);
                            setWant((w) => (s ? { ...w, 성별: s.성별.slice(0, 1) || undefined, 나이: s.생년 || undefined, 지역: s.지역 || undefined } : { 같은성별만: w.같은성별만 }));
                        }}
                    />
                    <Segmented
                        aria-label="성별"
                        value={want.성별 ?? '상관없음'}
                        options={['상관없음', '남', '여']}
                        onChange={(v) => set({ 성별: v === '상관없음' ? undefined : String(v) })}
                    />
                    <Input placeholder="나이 (20대초, 1998)" value={want.나이 ?? ''} onChange={(e) => set({ 나이: e.target.value })} style={{ width: 160 }} aria-label="나이" />
                    {regions.length > 1 && (
                        <Select allowClear placeholder="지역" value={want.지역} onChange={(v) => set({ 지역: v })} style={{ width: 120 }} aria-label="지역" options={regions.map((r) => ({ value: r, label: r }))} />
                    )}
                    <Input placeholder="키워드 (주말 저녁 음악)" value={want.키워드 ?? ''} onChange={(e) => set({ 키워드: e.target.value })} style={{ width: 220 }} aria-label="키워드" />
                    <Checkbox checked={want.같은성별만} onChange={(e) => set({ 같은성별만: e.target.checked })}>
                        같은 성별만
                    </Checkbox>
                </Space>
                <div className="hint" style={{ color: 'var(--muted)', fontSize: 12 }}>
                    점수: 같은 성별 3 · 같은 지역 2 · 나이 ±5세 2 (±10세 1) · 등급 상 2 / 중 1 · 정교사 1 · 담당 없음 2 / 1~2명 1 / 5명 이상 -1 · 키워드가 프로필에 있으면 하나당 2
                </div>
                {touched ? (
                    <Table<Match>
                        rowKey={(m) => m.t.key}
                        size="small"
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        dataSource={result}
                        locale={{ emptyText: '조건에 맞는 교사가 없습니다' }}
                        onRow={(m) => ({ onClick: () => onOpen(m.t), style: { cursor: 'pointer' } })}
                        columns={[
                            { title: '순위', render: (_, __, i) => i + 1, align: 'right' },
                            {
                                title: '이름',
                                render: (_, m) => (
                                    <Button type="link" size="small" style={{ padding: 0, fontWeight: 600 }} onClick={() => onOpen(m.t)}>
                                        {m.t.row.이름}
                                    </Button>
                                ),
                            },
                            { title: '지역', render: (_, m) => `${m.t.row.지역} ${m.t.row.팀 ?? ''}` },
                            { title: '점수', dataIndex: 'score', align: 'right' },
                            {
                                title: '이유',
                                render: (_, m) => (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {m.reasons.map((r) => (
                                            <Tag key={r} bordered={false} color={r.startsWith('담당 많음') ? 'orange' : undefined}>
                                                {r}
                                            </Tag>
                                        ))}
                                    </div>
                                ),
                            },
                        ]}
                    />
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="학생을 고르거나 조건을 넣으면 맞는 교사를 점수순으로 보여줍니다" />
                )}
            </div>
        </Card>
    );
}
