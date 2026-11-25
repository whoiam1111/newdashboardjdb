// Next.js 웹앱이 쓰는 통로 (서비스 계정 키 대신).
//   GET  ?token=…                  → 전체명단 (읽기만)
//   GET  ?token=…&action=accounts  → 로그인 계정의 비밀번호 해시 목록 (숨김 탭 '계정')
//   GET  ?token=…&action=goals     → 개강설정·목표 탭 (읽기만)
//   GET  ?token=…&action=teachers  → 교사 탭 (읽기만)
//   POST {token, action:'setPassword', id, hash} → 그 계정의 비밀번호 해시 저장. 비밀번호 원문은 오지 않는다
// 설치:
//   1) organize.gs 가 있는 Apps Script 에 파일 추가(+ → 스크립트, 이름 api)로 붙여넣고 저장
//   2) 왼쪽 ⚙ 프로젝트 설정 → 스크립트 속성 → 속성 추가: VIEW_TOKEN = 아무도 모를 긴 문자열(32자 이상)
//   3) 배포 → 새 배포 → 유형 '웹 앱', 실행: 나, 액세스 권한: 모든 사용자
//      (서버가 구글 로그인 없이 부르기 때문. 토큰이 틀리면 아무것도 주지 않는다)
//   4) 웹 앱 URL 과 VIEW_TOKEN 을 Next.js .env.local 의 SHEET_API_URL, SHEET_API_TOKEN 에 넣기
//   코드를 고친 뒤엔 배포 관리 → 수정 → 새 버전 으로 다시 배포

const ACCOUNTS_TAB = '계정';

const json_ = (o) => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const authorized_ = (t) => {
    const token = PropertiesService.getScriptProperties().getProperty('VIEW_TOKEN');
    return !!token && token.length >= 32 && t === token;
};

function doGet(e) {
    if (!authorized_(e.parameter.token)) return json_({ error: 'unauthorized' });
    if (e.parameter.action === 'accounts') {
        const sh = SpreadsheetApp.getActive().getSheetByName(ACCOUNTS_TAB);
        const rows = sh ? sh.getDataRange().getDisplayValues().slice(1) : [];
        return json_({ accounts: rows.filter((r) => r[0]).map((r) => ({ id: r[0], hash: r[1], updatedAt: r[2] })) });
    }
    if (e.parameter.action === 'goals') {
        const tab = (n) => SpreadsheetApp.getActive().getSheetByName(n)?.getDataRange().getDisplayValues() ?? [];
        return json_({ settings: tab(SETTINGS_TAB), goals: tab(GOALS_TAB) });
    }
    if (e.parameter.action === 'teachers') {
        const sh = SpreadsheetApp.getActive().getSheetByName(TEACHERS_TAB);
        return json_({ values: sh ? sh.getDataRange().getDisplayValues() : [] });
    }
    const sh = SpreadsheetApp.getActive().getSheetByName(ALL);
    return json_({ title: sh.getName(), values: sh.getDataRange().getDisplayValues() });
}

function doPost(e) {
    let body;
    try {
        body = JSON.parse(e.postData.contents);
    } catch (_) {
        return json_({ error: 'bad request' });
    }
    if (!authorized_(body.token)) return json_({ error: 'unauthorized' });
    if (body.action !== 'setPassword' || !/^[가-힣a-z0-9]{1,20}$/i.test(body.id || '') || !/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/.test(body.hash || ''))
        return json_({ error: 'bad request' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
        const ss = SpreadsheetApp.getActive();
        let sh = ss.getSheetByName(ACCOUNTS_TAB);
        if (!sh) {
            sh = ss.insertSheet(ACCOUNTS_TAB);
            sh.appendRow(['아이디', '비밀번호해시', '변경일시']);
            sh.hideSheet();
        }
        const now = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
        const ids = sh.getDataRange().getDisplayValues().map((r) => r[0]);
        const i = ids.indexOf(body.id);
        if (i > 0) sh.getRange(i + 1, 2, 1, 2).setNumberFormat('@').setValues([[body.hash, now]]);
        else sh.appendRow([body.id, body.hash, now]);
    } finally {
        lock.releaseLock();
    }
    return json_({ ok: true });
}
