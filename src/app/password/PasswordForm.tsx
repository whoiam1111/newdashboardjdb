'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Input } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { changeMyPassword, logout } from '../actions';

export default function PasswordForm({ id, forced }: { id: string; forced: boolean }) {
    const [error, action, pending] = useActionState(changeMyPassword, null);
    return (
        <div className="auth">
            <Card className="auth-card">
                <div className="auth-head">
                    <span className="avatar" style={{ width: 48, height: 48, fontSize: 20 }}>
                        <LockOutlined />
                    </span>
                    <h1>{id} 비밀번호 변경</h1>
                    <p>{forced ? '처음 로그인입니다. 사용할 비밀번호를 정해주세요.' : '새 비밀번호는 8자 이상입니다.'}</p>
                </div>
                <form action={action} style={{ display: 'grid', gap: 12 }}>
                    <input type="hidden" name="username" value={id} autoComplete="username" />
                    <Input.Password size="large" name="current" placeholder="현재 비밀번호" aria-label="현재 비밀번호" autoComplete="current-password" autoFocus />
                    <Input.Password size="large" name="next" placeholder="새 비밀번호 (8자 이상)" aria-label="새 비밀번호" autoComplete="new-password" />
                    <Input.Password size="large" name="confirm" placeholder="새 비밀번호 확인" aria-label="새 비밀번호 확인" autoComplete="new-password" />
                    {error && <Alert type="error" message={error} showIcon />}
                    <Button type="primary" size="large" htmlType="submit" loading={pending} block>
                        변경
                    </Button>
                </form>
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                    {forced ? (
                        <form action={logout}>
                            <Button type="link" htmlType="submit">
                                로그아웃
                            </Button>
                        </form>
                    ) : (
                        <Link href="/">돌아가기</Link>
                    )}
                </div>
            </Card>
        </div>
    );
}
