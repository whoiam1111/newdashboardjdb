'use client';
import { useActionState } from 'react';
import { Alert, Button, Card, Input } from 'antd';
import { LockOutlined, StarFilled, UserOutlined } from '@ant-design/icons';
import { login } from '../actions';

export default function LoginPage() {
    const [error, action, pending] = useActionState(login, null);
    return (
        <div className="auth">
            <Card className="auth-card">
                <div className="auth-head">
                    <span className="brand-mark" style={{ width: 48, height: 48, fontSize: 22 }}>
                        <StarFilled />
                    </span>
                    <h1>발굴 명단</h1>
                    <p>지역 아이디로 로그인하세요</p>
                </div>
                <form action={action} style={{ display: 'grid', gap: 12 }}>
                    <Input
                        size="large"
                        name="id"
                        prefix={<UserOutlined style={{ color: 'var(--muted)' }} />}
                        placeholder="아이디"
                        autoFocus
                        aria-label="아이디"
                        autoComplete="username"
                    />
                    <Input.Password
                        size="large"
                        name="password"
                        prefix={<LockOutlined style={{ color: 'var(--muted)' }} />}
                        placeholder="비밀번호"
                        aria-label="비밀번호"
                        autoComplete="current-password"
                    />
                    {error && <Alert type="error" message={error} showIcon />}
                    <Button type="primary" size="large" htmlType="submit" loading={pending} block>
                        로그인
                    </Button>
                </form>
            </Card>
        </div>
    );
}
