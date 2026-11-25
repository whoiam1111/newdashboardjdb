'use client';
import { useMemo, useState } from 'react';
import { Button, Card, Empty, Input, InputNumber, Segmented, Select, Tag, message } from 'antd';
import { AimOutlined, CopyOutlined } from '@ant-design/icons';
import { CardTitle } from '../../ui';
import {
    ageOf,
    EMPTY_FILTERS,
    formatTeacherProfile,
    matchTeachers,
    prefsOf,
    searchTeachers,
    TIME_SLOTS,
    timesOf,
    type SearchFilters,
    type TeacherView,
} from '@/lib/teachers';

const PAGE = 36;
const BUSY = 3; // jdb 와 같은 '담당 많음' 기준

// 클립보드 복사 (https 가 아닌 곳에서는 예전 방식으로)
async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
    }
}

const Label = ({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sub)' }}>{children}</span>
        {extra}
    </div>
);

// 교사 매칭 찾기 (jdb 교사 조회와 같은 조건·카드·프로필 복사). 조건을 모두 만족하는 교사만, 맞는 정도 순으로
export default function MatchFinder({ teachers, onOpen }: { teachers: TeacherView[]; onOpen: (t: TeacherView) => void }) {
    const [f, setF] = useState<SearchFilters>(EMPTY_FILTERS);
    const [limit, setLimit] = useState(PAGE);
    const [msg, holder] = message.useMessage();
    const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => {
        setF((p) => ({ ...p, [k]: v }));
        setLimit(PAGE); // 조건이 바뀌면 처음부터
    };

    const regions = useMemo(() => {
        const n = new Map<string, number>();
        for (const t of teachers) if (t.row.지역) n.set(t.row.지역, (n.get(t.row.지역) ?? 0) + 1);
        return [...n];
    }, [teachers]);

    // 조건으로 거르고, 등급·담당 수 등으로 맞는 정도 순으로 줄 세운다
    const results = useMemo(() => matchTeachers(searchTeachers(teachers, f), { 성별: f.성별, 지역: f.지역, 키워드: f.q }), [teachers, f]);

    const copyOne = async (t: TeacherView) => {
        if (await copyText(formatTeacherProfile(t.row))) msg.success(`${t.row.이름} 프로필을 복사했습니다.`);
        else msg.error('복사하지 못했습니다.');
    };
    const copyAll = async () => {
        if (await copyText(results.map((m) => formatTeacherProfile(m.t.row)).join('\n\n\n')))
            msg.success(`${f.지역 || '전체 지역'} 교사 ${results.length}명 프로필을 복사했습니다.`);
        else msg.error('복사하지 못했습니다.');
    };

    const active = [f.q.trim(), f.지역, f.성별, f.교사형태, f.times.length, f.ageMin || f.ageMax, f.mbti.trim(), f.ennea].filter(Boolean).length;
    const target = (v: 'teacher' | 'preferred', on: (v: 'teacher' | 'preferred') => void) => (
        <Segmented
            size="small"
            value={v}
            onChange={(x) => on(x as 'teacher' | 'preferred')}
            options={[
                { label: '본인', value: 'teacher' },
                { label: '선호', value: 'preferred' },
            ]}
        />
    );

    return (
        <Card title={<CardTitle icon={<AimOutlined />}>교사 매칭 찾기</CardTitle>}>
            {holder}
            <div className="match">
                {/* 검색 조건 (넓은 화면에서는 왼쪽에 고정) */}
                <div className="match-filters">
                    <div>
                        <Label>검색어</Label>
                        <Input allowClear placeholder="이름, 직업, 전공, 자격증, 취미" value={f.q} onChange={(e) => set('q', e.target.value)} aria-label="검색어" />
                    </div>
                    {regions.length > 1 && (
                        <div>
                            <Label>지역</Label>
                            <Select
                                style={{ width: '100%' }}
                                value={f.지역}
                                onChange={(v) => set('지역', v)}
                                aria-label="지역"
                                options={[{ value: '', label: '전체 지역' }, ...regions.map(([r, n]) => ({ value: r, label: `${r} (${n})` }))]}
                            />
                        </div>
                    )}
                    <div>
                        <Label>성별</Label>
                        <Segmented block value={f.성별 || '전체'} options={['전체', '남', '여']} onChange={(v) => set('성별', v === '전체' ? '' : (v as '남' | '여'))} />
                    </div>
                    <div>
                        <Label>교사 구분</Label>
                        <Segmented
                            block
                            value={f.교사형태 || '전체'}
                            options={['전체', '정교사', '교사', '예비교사']}
                            onChange={(v) => set('교사형태', v === '전체' ? '' : (v as SearchFilters['교사형태']))}
                        />
                    </div>
                    <div>
                        <Label>가능 시간 (고른 시간에 모두 가능한 교사)</Label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {TIME_SLOTS.map((s) => (
                                <Tag.CheckableTag
                                    key={s}
                                    checked={f.times.includes(s)}
                                    onChange={(on) => set('times', on ? [...f.times, s] : f.times.filter((x) => x !== s))}
                                    style={{ border: '1px solid var(--border)', padding: '2px 10px', borderRadius: 999, margin: 0 }}
                                >
                                    {s}
                                </Tag.CheckableTag>
                            ))}
                        </div>
                    </div>
                    <div>
                        <Label>나이</Label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <InputNumber min={1} max={99} placeholder="부터" value={f.ageMin ? Number(f.ageMin) : null} onChange={(v) => set('ageMin', v ? String(v) : '')} style={{ flex: 1 }} aria-label="나이 부터" />
                            <span style={{ color: 'var(--muted)' }}>~</span>
                            <InputNumber min={1} max={99} placeholder="까지" value={f.ageMax ? Number(f.ageMax) : null} onChange={(v) => set('ageMax', v ? String(v) : '')} style={{ flex: 1 }} aria-label="나이 까지" />
                        </div>
                    </div>
                    <div>
                        <Label extra={target(f.mbtiTarget, (v) => set('mbtiTarget', v))}>MBTI</Label>
                        <Input maxLength={4} placeholder="예: ENFP, NF" value={f.mbti} onChange={(e) => set('mbti', e.target.value.toUpperCase())} aria-label="MBTI" />
                    </div>
                    <div>
                        <Label extra={target(f.enneaTarget, (v) => set('enneaTarget', v))}>에니어그램</Label>
                        <Select
                            style={{ width: '100%' }}
                            value={f.ennea}
                            onChange={(v) => set('ennea', v)}
                            aria-label="에니어그램"
                            options={[{ value: '', label: '전체' }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: String(n), label: `${n}번 유형` }))]}
                        />
                    </div>
                    {active > 0 && (
                        <div style={{ textAlign: 'right' }}>
                            <Button
                                type="link"
                                size="small"
                                onClick={() => {
                                    setF(EMPTY_FILTERS);
                                    setLimit(PAGE);
                                }}
                            >
                                조건 {active}개 모두 지우기
                            </Button>
                        </div>
                    )}
                </div>

                {/* 결과 */}
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                        <span style={{ fontWeight: 600, color: 'var(--sub)' }}>
                            <span style={{ color: 'var(--primary)' }}>{results.length}</span>명{results.length > limit && ` 중 ${limit}명 표시`}
                        </span>
                        {results.length > 0 && (
                            <Button size="small" icon={<CopyOutlined />} onClick={copyAll}>
                                {f.지역 || '지역'} 전체 복사 ({results.length}명)
                            </Button>
                        )}
                    </div>
                    {results.length === 0 ? (
                        <Empty description="조건에 맞는 교사가 없습니다. 조건을 줄여 보세요." />
                    ) : (
                        <div className="match-cards">
                            {results.slice(0, limit).map(({ t }) => (
                                <TeacherCard key={t.key} t={t} picked={f.times} onOpen={() => onOpen(t)} onCopy={() => copyOne(t)} />
                            ))}
                            {results.length > limit && (
                                <Button block style={{ gridColumn: '1 / -1' }} onClick={() => setLimit((l) => l + PAGE)}>
                                    더 보기 ({results.length - limit}명 남음)
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}

function TeacherCard({ t, picked, onOpen, onCopy }: { t: TeacherView; picked: string[]; onOpen: () => void; onCopy: () => void }) {
    const r = t.row;
    const male = (r.성별 ?? '').startsWith('남');
    const age = ageOf(r.출생연도);
    const times = timesOf(r.가능시간);
    const prefs = prefsOf(r.선호사항);
    const details = [
        ['전공', r.전공],
        ['자격', r.자격증],
        ['취미', r.취미],
    ].filter(([, v]) => v?.trim());
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(e) => e.key === 'Enter' && onOpen()}
            className="match-card"
            style={{ borderLeftColor: male ? '#38bdf8' : r.성별 ? '#fb7185' : 'var(--border)' }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span className="avatar" style={{ width: 40, height: 40, background: male ? '#0ea5e9' : r.성별 ? '#fb7185' : undefined, color: r.성별 ? '#fff' : undefined }}>
                    {r.이름.slice(0, 1)}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 15 }}>{r.이름}</b>
                        <span style={{ fontSize: 12, color: 'var(--sub)' }}>{[r.성별, age && `${age}세`].filter(Boolean).join(' · ')}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.지역} {r.팀} · {r.교사형태 || '형태 없음'}
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Tag bordered={false} style={{ margin: 0 }}>
                            등급 {r.등급}
                        </Tag>
                        <Tag bordered={false} color={t.담당.length >= BUSY ? 'orange' : t.담당.length ? 'green' : undefined} style={{ margin: 0 }}>
                            담당 {t.담당.length}명
                        </Tag>
                    </div>
                </div>
                <Button
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onCopy();
                    }}
                    title="교사프로필 양식으로 복사"
                >
                    복사
                </Button>
            </div>
            <div style={{ marginTop: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.직업 || <span style={{ color: 'var(--muted)' }}>직업 미기재</span>}
            </div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, textAlign: 'center' }}>
                {[
                    ['MBTI', r.MBTI],
                    ['에니어', r.에니어그램],
                    // 선호는 'ISFP · 9번' 처럼 짧게, 여러 개면 쉼표로. 마우스를 올리면 이유까지 전체
                    ['선호', prefs.map((p) => [p.mbti, p.ennea && `${p.ennea}번`].filter(Boolean).join(' · ')).filter(Boolean).join(', '), r.선호사항],
                ].map(([label, v, full]) => (
                    <div key={label} style={{ background: 'var(--soft)', borderRadius: 8, padding: '4px 6px', minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
                        <div title={full ?? v} style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {v || '-'}
                        </div>
                    </div>
                ))}
            </div>
            {details.length > 0 && (
                <dl style={{ margin: '10px 0 0', fontSize: 12, display: 'grid', gap: 2 }}>
                    {details.map(([label, v]) => (
                        <div key={label} style={{ display: 'flex', gap: 8 }}>
                            <dt style={{ width: 28, flexShrink: 0, color: 'var(--muted)' }}>{label}</dt>
                            <dd style={{ margin: 0, minWidth: 0, wordBreak: 'break-word' }}>{v}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {times.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {times.map((s) => (
                        <Tag key={s} bordered={false} color={picked.includes(s) ? 'purple' : undefined} style={{ margin: 0 }}>
                            {s}
                        </Tag>
                    ))}
                </div>
            )}
        </div>
    );
}
