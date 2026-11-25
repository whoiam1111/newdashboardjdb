import { expect, test, vi } from 'vitest';
import { readSheet, toRecords } from './sheet';
import { computeGoals, currentCampaign, parseCampaigns } from './goals';
import { ageOf, buildTeachers, compareRegions, EMPTY_FILTERS, formatTeacherProfile, groupsOf, matchTeachers, searchTeachers, type SearchFilters } from './teachers';
import { signSession, verifySession } from './session';
import { authenticate, hashPassword, lockedMinutes, newPasswordError, recordLogin, sheetStore, verifyHash, type Store, type Stored } from './accounts';
import { findDuplicates, forUser, isDropped, summarize } from './dashboard';

test('toRecords: 헤더 매핑, 이름 빈 행 제외, 짧은 행 채움', () => {
    const { records } = toRecords([['현재상태', '이름', '연락처'], ['발', '이창환'], ['', '', ''], ['탈', '김', '1']]);
    expect(records).toEqual([
        { key: '0', 현재상태: '발', 이름: '이창환', 연락처: '' },
        { key: '1', 현재상태: '탈', 이름: '김', 연락처: '1' },
    ]);
});

test('toRecords: 위에 제목 행이 있으면 이름 행을 헤더로', () => {
    const { headers, records } = toRecords([['', '발굴등록 리스트'], ['양식', '현재상태', '이름'], ['x', '발', '김']]);
    expect(headers).toEqual(['양식', '현재상태', '이름']);
    expect(records).toEqual([{ key: '0', 양식: 'x', 현재상태: '발', 이름: '김' }]);
});

test('session: 계정·지역·첫 비밀번호 표시가 그대로 돌아온다', async () => {
    process.env.SESSION_SECRET = 'x'.repeat(32);
    const dobong = { id: '도봉', region: '도봉', mustChange: true };
    expect(await verifySession(await signSession(dobong))).toEqual(dobong);
    const admin = { id: 'jdb', region: null, mustChange: false };
    expect(await verifySession(await signSession(admin))).toEqual(admin);
    expect(await verifySession('garbage')).toBe(null);
    expect(await verifySession(undefined)).toBe(null);
});

test('authenticate: 처음엔 INITIAL_PASSWORD + 변경 필요, 바꾼 뒤엔 새 비번만', async () => {
    process.env.INITIAL_PASSWORD = 'jdb1234';
    const saved: Stored[] = [];
    const store: Store = {
        list: async () => saved,
        set: async (id, hash) => void saved.push({ id, hash, updatedAt: 'now' }),
    };
    expect(await authenticate('도봉', 'jdb1234', store)).toBe(null); // 8자 미만 처음 비밀번호는 무시
    process.env.INITIAL_PASSWORD = 'init-pass-1234';
    expect(await authenticate('도봉', 'jdb1234', store)).toBe(null); // 예전 공개 비밀번호
    expect(await authenticate('도봉', 'init-pass-1234', store)).toEqual({ id: '도봉', region: '도봉', mustChange: true });
    expect(await authenticate('jdb', 'init-pass-1234', store)).toEqual({ id: 'jdb', region: null, mustChange: true });
    expect(await authenticate('도봉', 'wrong', store)).toBe(null);
    expect(await authenticate('admin', 'init-pass-1234', store)).toBe(null); // 목록에 없는 아이디
    await store.set('도봉', hashPassword('새비밀번호123'));
    expect(await authenticate('도봉', 'init-pass-1234', store)).toBe(null);
    expect(await authenticate(' 도봉 ', '새비밀번호123', store)).toEqual({ id: '도봉', region: '도봉', mustChange: false });
    expect(verifyHash('x', 'garbage')).toBe(false);
    // 관리자가 정해준 비밀번호: 로그인은 되지만 바꿔야 함
    await store.set('노원', hashPassword('관리자가정함1') + '$reset');
    expect(await authenticate('노원', '관리자가정함1', store)).toEqual({ id: '노원', region: '노원', mustChange: true });
});

test('newPasswordError / 로그인 잠금', () => {
    expect(newPasswordError('short', 'short')).toMatch('8자');
    expect(newPasswordError('jdb1234', 'jdb1234')).toMatch('8자');
    expect(newPasswordError('abcdefgh', 'abcdefgX')).toMatch('다릅니다');
    expect(newPasswordError('init-pass-1234', 'init-pass-1234')).toMatch('처음 비밀번호');
    expect(newPasswordError('abcdefgh', 'abcdefgh')).toBe(null);
    recordLogin('없는아이디', false, 0);
    expect(lockedMinutes('없는아이디', 1000)).toBe(0);
    for (let i = 0; i < 5; i++) recordLogin('성북', false, 0);
    expect(lockedMinutes('성북', 1000)).toBe(10);
    expect(lockedMinutes('성북', 11 * 60_000)).toBe(0);
    recordLogin('성북', true);
    expect(lockedMinutes('성북', 1000)).toBe(0);
});

test('forUser / summarize: 지역 범위와 집계', () => {
    const rows: Record<string, string>[] = [
        { 현재상태: '발', 인도자지역: '도봉', 인도자팀: '1-2', 교사지역: '', 발굴등록날짜: '2026-11-03' },
        { 현재상태: '합', 인도자지역: '성북', 인도자팀: '2', 교사지역: '도봉', 합날짜: '2026. 11. 20' },
        { 현재상태: '탈', 인도자지역: '도봉', 인도자팀: '1', 교사지역: '', 발굴탈락날짜: '2026-11-21' },
        { 현재상태: '찾', 인도자지역: '노원', 인도자팀: '3', 교사지역: '', 찾기날짜: '2026-11-01' },
    ];
    const dobong = { id: '도봉', region: '도봉', mustChange: false };
    const mine = forUser(rows, dobong);
    expect(mine).toHaveLength(3);
    const s = summarize(mine, dobong, '2026-11');
    expect(s.total).toBe(2);
    expect(s.month).toEqual({ 발굴: 1, 찾기: 0, 합: 1, 탈락: 1 });
    expect(s.groups.map((g) => g.name).sort()).toEqual(['1팀', '다른 지역 인도자']);
    const all = summarize(rows, { id: 'jdb', region: null, mustChange: false }, '2026-11');
    expect(all.total).toBe(3);
    expect(all.groups[0]).toMatchObject({ total: 1 });
});

test('readSheet: Apps Script 응답 읽기, 토큰 오류, 5분 캐시', async () => {
    process.env.SHEET_API_URL = 'https://example.test/exec';
    process.env.SHEET_API_TOKEN = 't';
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'unauthorized' })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(readSheet()).rejects.toThrow('unauthorized');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ title: '전체명단', values: [['번호', '이름'], ['1', '김']] })));
    expect(await readSheet()).toMatchObject({ title: '전체명단', records: [{ 번호: '1', 이름: '김' }] });
    await readSheet();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
});

test('sheetStore: 예전 배포(계정 목록 없음·저장 미지원)면 jdb1234 로 통과시키지 않고 오류', async () => {
    process.env.SHEET_API_URL = 'https://example.test/exec';
    process.env.SHEET_API_TOKEN = 't';
    const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ title: '전체명단', values: [] })))
        .mockResolvedValueOnce(new Response('<html>Script function not found: doPost</html>'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(authenticate('도봉', 'init-pass-1234')).rejects.toThrow('예전 버전');
    await expect(sheetStore.set('도봉', 'scrypt$a$b')).rejects.toThrow('JSON 이 아닌 응답');
    vi.unstubAllGlobals();
});

test('findDuplicates / isDropped: 다른 지역 이름+뒷4자리, 지역 계정 범위, 탈락 포함 여부', () => {
    const rows: Record<string, string>[] = [
        { 번호: '1', 현재상태: '발', 이름: '김철수', 연락처: '010-1111-2222', 인도자지역: '도봉' },
        { 번호: '2', 현재상태: '찾', 이름: '김철수', 연락처: '2222', 인도자지역: '노원' },
        { 번호: '3', 현재상태: '탈', 이름: '김철수', 연락처: '2222', 인도자지역: '성북' },
        { 번호: '4', 현재상태: '발', 이름: '이영희', 연락처: '3333', 인도자지역: '도봉' },
        { 번호: '5', 현재상태: '합', 이름: '이영희', 연락처: '3333', 인도자지역: '도봉' }, // 같은 지역끼리는 제외
        { 번호: '6', 현재상태: '발', 이름: '박', 연락처: '', 인도자지역: '중랑' },
        { 번호: '7', 현재상태: '찾탈', 이름: '박', 연락처: '', 인도자지역: '강북' }, // 연락처 없으면 비교 안 함
        { 번호: '8', 현재상태: '발', 이름: '최', 연락처: '4444', 인도자지역: '중랑' },
        { 번호: '9', 현재상태: '합탈', 이름: '최', 연락처: '4444', 인도자지역: '강북' },
    ];
    rows.push(
        { 번호: '10', 현재상태: '탈', 이름: '정', 연락처: '5555', 인도자지역: '도봉', 발굴탈락날짜: '2026-10-01' },
        { 번호: '11', 현재상태: '찾탈', 이름: '정', 연락처: '5555', 인도자지역: '노원' }, // 둘 다 탈락
    );
    Object.assign(rows[0], { 발굴등록날짜: '2026-09-01' });
    Object.assign(rows[1], { 찾기날짜: '2026. 11. 20' });
    Object.assign(rows[2], { 발굴탈락날짜: '2026-10-05' });
    Object.assign(rows[7], { 발굴등록날짜: '2026-11-25' });
    const admin = { id: 'jdb', region: null, mustChange: false };
    expect(isDropped(rows[6])).toBe(true);
    // 진행 중인 줄이 하나라도 있으면 탈락 줄도 함께, 최근 날짜 순 (묶음·줄 모두)
    const cur = findDuplicates(rows, admin, false);
    expect(cur.map((g) => [g.이름, g.최근날짜, g.rows.map((r) => r.번호)])).toEqual([
        ['최', '2026-11-25', ['8', '9']],
        ['김철수', '2026-11-20', ['2', '3', '1']],
    ]);
    expect(findDuplicates(rows, admin, true).map((g) => g.이름)).toEqual(['최', '김철수', '정']);
    const sb = { id: '성북', region: '성북', mustChange: false };
    expect(findDuplicates(rows, sb, false).map((g) => g.이름)).toEqual(['김철수']); // 성북은 탈락 줄이지만 같은 묶음에 진행 중이 있음
    expect(findDuplicates(rows, sb, true)[0].지역).toEqual(['노원', '성북', '도봉']);
    // 성북 계정에게 도봉 줄 연락처는 뒤 4자리만, 관리자는 전체
    expect(findDuplicates(rows, sb, true)[0].rows[2].연락처).toBe('***-****-2222');
    expect(cur[1].rows[2].연락처).toBe('010-1111-2222');
});

test('목표 달성: 개강 기간, 발·찾 발굴 주차, 0.5점 나눔, 목표 × 배수, 목표월', () => {
    const [c] = parseCampaigns([
        ['개강월', '1주차시작일', '주차수', '발배수', '찾배수', '합배수', '섭배수', '복배수'],
        ['2026-12', '2026-11-02', '8', '', '', '', '', ''],
        ['잘못된줄', '', '', '', '', '', '', ''],
    ]);
    expect(c).toMatchObject({ month: '2026-12', start: '2026-11-02', end: '2026-12-27', balEnd: '2026-11-22', weeks: 8 });
    expect(currentCampaign([c], '2026-11-25')?.month).toBe('2026-12');
    const goals = [['개강월', '지역', '팀', '예정목표'], ['2026-12', '도봉', '1', '1.5'], ['2026-12', '도봉', '사랑', '0.5'], ['2026-11', '도봉', '1', '9']];
    const recs: Record<string, string>[] = [
        { 인도자지역: '도봉', 인도자팀: '1-2', 교사지역: '성북', 교사팀: '3', 발굴등록날짜: '2026-11-03', 찾기날짜: '2026-11-30', 섭날짜: '2026. 12. 1' },
        { 인도자지역: '도봉', 인도자팀: '사랑-1', 교사지역: '도봉', 교사팀: '사랑', 예정날짜: '2026-12-10', 목표월: '12월' },
        { 인도자지역: '도봉', 인도자팀: '1', 합날짜: '2026-12-01', 목표월: '1월' }, // 목표월이 달라 제외
        { 인도자지역: '타지파', 인도자팀: '1', 발굴등록날짜: '2026-11-03' }, // 모르는 지역 제외
    ];
    const rows = computeGoals(c, goals, recs);
    const by = (region: string, team: string) => rows.find((r) => r.region === region && r.team === team)!;
    expect(by('도봉', '1').goal).toEqual({ 발: 45, 찾: 15, 합: 6, 섭: 3, 복: 2.3, 예정: 1.5 });
    expect(by('도봉', '1').actual).toMatchObject({ 발: 1, 찾: 0, 합: 0, 섭: 0.5 }); // 찾기는 발굴 주차 뒤라 제외
    expect(by('성북', '3').actual.섭).toBe(0.5);
    expect(by('도봉', '사랑').actual.예정).toBe(1);
    expect(rows.map((r) => r.region + r.team)).toEqual(['도봉1', '도봉사랑', '성북3']);
});

test('buildTeachers: 지역 범위, 담당 학생(고유번호 또는 지역+이름+팀), 탈락·합 전 제외, 프로필 여부', () => {
    const values = [
        ['고유번호', '지역', '팀', '이름', '교사형태', '등급', 'MBTI'],
        ['T1', '도봉', '1-2', '김교사', '정교사', '상', 'INFP'],
        ['', '도봉', '2', '박교사', '교사', '', ''],
        ['T3', '노원', '1', '김교사', '교사', '중', ''],
        ['', '', '', '', '', '', ''],
        ['고유번호', '지역', '팀', '이름', '교사형태', '등급', 'MBTI'], // 끼어든 헤더 줄
        ['T1', '도봉', '1-2', '김교사', '정교사', '', 'ESTJ'], // 같은 교사 한 번 더: 앞 줄 값 우선
        ['', '도봉', '2', '박교사', '교사', '중', ''], // 고유번호 없으면 지역+팀+이름으로 합침, 빈 등급은 뒤 줄 값
    ];
    const students: Record<string, string>[] = [
        { 이름: 'a', 현재상태: '합', 교사고유번호: 'T1', 교사지역: '도봉', 교사이름: '김교사' },
        { 이름: 'b', 현재상태: '섭', 교사고유번호: '', 교사지역: '도봉', 교사이름: '김교사', 교사팀: '1' },
        { 이름: 'c', 현재상태: '합탈', 교사고유번호: 'T1' }, // 탈락
        { 이름: 'd', 현재상태: '찾', 교사고유번호: 'T1' }, // 합 전
        { 이름: 'e', 현재상태: '복', 교사고유번호: '', 교사지역: '도봉', 교사이름: '박교사', 교사팀: '3' }, // 팀 다름
        { 이름: 'f', 현재상태: '예정', 교사고유번호: 'T3', 교사지역: '노원', 교사이름: '김교사' },
    ];
    const { teachers: all, duplicates } = buildTeachers(values, students, { id: 'jdb', region: null, mustChange: false });
    expect(duplicates).toBe(2);
    expect(all[0].row.MBTI).toBe('INFP');
    expect(all.map((t) => [t.row.이름, t.담당, t.활동, t.프로필])).toEqual([
        ['김교사', ['a(합)', 'b(섭)'], true, true],
        ['박교사', [], false, false],
        ['김교사', ['f(예정)'], true, false],
    ]);
    expect(buildTeachers(values, students, { id: '노원', region: '노원', mustChange: false }).teachers.map((t) => t.row.고유번호)).toEqual(['T3']);
    expect(all.map((t) => t.row.등급)).toEqual(['상', '중', '중']); // 박교사는 뒤 줄 등급 '중'으로 채워짐
});

test('ageOf / matchTeachers: 성별·나이·지역·등급·담당·키워드 점수', () => {
    expect(ageOf('20대초', 2026)).toBe(22);
    expect(ageOf('1996', 2026)).toBe(30);
    expect(ageOf('96', 2026)).toBe(30);
    expect(ageOf('05', 2026)).toBe(21);
    expect(ageOf('모름', 2026)).toBe(null);
    const t = (key: string, row: Record<string, string>, 담당: string[] = []) => ({ key, row, 담당, 활동: 담당.length > 0, 프로필: true });
    const list = [
        t('a', { 이름: 'A', 지역: '도봉', 성별: '남', 출생연도: '2001', 등급: '상', 교사형태: '정교사', 가능시간: '주말 저녁' }),
        t('b', { 이름: 'B', 지역: '노원', 성별: '여', 출생연도: '1980', 등급: '하' }, ['x', 'y', 'z', 'w', 'v']),
        t('c', { 이름: 'C', 지역: '도봉', 성별: '남자', 출생연도: '1975', 등급: '중' }, ['x']),
    ];
    const res = matchTeachers(list, { 성별: '남', 나이: '20대초', 지역: '도봉', 키워드: '주말' }, 2026);
    expect(res.map((m) => m.t.key)).toEqual(['a', 'c', 'b']);
    expect(res[0].reasons).toEqual(['같은 성별', '같은 지역', '나이 비슷 (±3)', '등급 상', '정교사', '담당 없음', "'주말'"]);
    expect(matchTeachers(list, { 성별: '남', 같은성별만: true }, 2026).map((m) => m.t.key)).toEqual(['a', 'c']);
});

test('groupsOf / compareRegions: MBTI E·I, 에니어그램 유형, 성별, 나이대', () => {
    expect(groupsOf({ MBTI: 'enfp', 에니어그램: '4w5', 성별: '여자', 출생연도: '2004' }, 2026)).toEqual({ MBTI: 'E', 에니어그램: '가슴형', 성별: '여', 나이: '20대초' });
    expect(groupsOf({ MBTI: 'ISTJ', 에니어그램: '1번', 출생연도: '1991' }, 2026)).toEqual({ MBTI: 'I', 에니어그램: '장형', 성별: '', 나이: '30대중' });
    expect(groupsOf({ 에니어그램: '머리형', 출생연도: '20대후' }, 2026)).toMatchObject({ 에니어그램: '머리형', 나이: '20대후', MBTI: '' });
    const t = (row: Record<string, string>) => ({ key: row.이름, row, 담당: [], 활동: false, 프로필: true });
    const rows = compareRegions([t({ 이름: 'a', 지역: '도봉', MBTI: 'E', 성별: '남' }), t({ 이름: 'b', 지역: '도봉', MBTI: 'I' }), t({ 이름: 'c', 지역: '노원', MBTI: 'E' })], 2026);
    expect(rows.map((r) => [r.region, r.교사, r.E, r.I, r.남])).toEqual([['도봉', 2, 1, 1, 1], ['노원', 1, 1, 0, 0], ['합계', 3, 2, 1, 1]]);
});

test('searchTeachers / formatTeacherProfile: jdb 교사 조회 조건과 양식', () => {
    const t = (row: Record<string, string>) => ({ key: row.이름, row, 담당: [], 활동: false, 프로필: true });
    const list = [
        t({ 이름: '가', 지역: '도봉', 성별: '남', 교사형태: '정교사', 출생연도: '1998', MBTI: 'ENFP', 에니어그램: '4w5', 가능시간: '평일저녁, 주말 오후', 직업: '디자이너', 선호사항: 'INTJ 5번' }),
        t({ 이름: '나', 지역: '노원', 성별: '여자', 교사형태: '교사', 출생연도: '1985', MBTI: 'ISTJ', 에니어그램: '1', 가능시간: '주말 오전' }),
    ];
    const f = (p: Partial<SearchFilters>) => searchTeachers(list, { ...EMPTY_FILTERS, ...p }, 2026).map((x) => x.key);
    expect(f({})).toEqual(['가', '나']);
    expect(f({ q: '디자' })).toEqual(['가']);
    expect(f({ 성별: '여' })).toEqual(['나']);
    expect(f({ times: ['평일 저녁', '주말 오후'] })).toEqual(['가']);
    expect(f({ times: ['평일 저녁', '주말 오전'] })).toEqual([]);
    expect(f({ ageMin: '25', ageMax: '30' })).toEqual(['가']);
    expect(f({ mbti: 'nf' })).toEqual(['가']);
    expect(f({ mbti: 'NT', mbtiTarget: 'preferred' })).toEqual(['가']);
    expect(f({ ennea: '4' })).toEqual(['가']);
    expect(f({ ennea: '5', enneaTarget: 'preferred' })).toEqual(['가']);
    expect(formatTeacherProfile({ 이름: '가', 성별: '남', 출생연도: '1998', 종교: '기독교,장로', 신앙연수: '3', 직업: '디자이너', 가능시간: '주말오후,평일 저녁' }, 2026)).toContain(
        '▪️이름/성별/나이: 가/남/28',
    );
    expect(formatTeacherProfile({ 이름: '가', 종교: '기독교,장로', 신앙연수: '3', 가능시간: '주말오후,평일 저녁' }, 2026)).toMatch(/기독교\(장로\)\/3년[\s\S]*만남가능 일시: 평일 저녁, 주말 오후/);
});
