'use client';
import { useActionState } from 'react';
import { Alert, Button, Card, Input, Table, Tag } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { CardTitle } from '../../ui';
import { setRegionPassword } from '../../actions';

type Row = { id: string; changed: boolean; updatedAt: string };

function SetPassword({ id }: { id: string }) {
    const [result, action, pending] = useActionState(setRegionPassword, null);
    return (
        <form action={action} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="hidden" name="id" value={id} />
            <Input.Password name="next" placeholder="새 비밀번호 (8자 이상)" aria-label={`${id} 새 비밀번호`} autoComplete="new-password" style={{ width: 200 }} />
            <Button htmlType="submit" loading={pending}>
                저장
            </Button>
            {result && <Alert type={result.ok ? 'success' : 'error'} message={result.message} showIcon style={{ padding: '0 8px' }} />}
        </form>
    );
}

export default function AccountsTable({ rows }: { rows: Row[] }) {
    return (
        <Card title={<CardTitle icon={<KeyOutlined />}>지역 계정 비밀번호</CardTitle>}>
            <p className="hint">처음 비밀번호(jdb1234)를 쓰는 계정은 첫 로그인 때 비밀번호를 바꿔야 합니다.</p>
            <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={rows}
                scroll={{ x: 'max-content' }}
                columns={[
                    { title: '아이디', dataIndex: 'id' },
                    {
                        title: '상태',
                        render: (_, r) =>
                            r.changed ? (
                                <Tag bordered={false} color="green">
                                    변경됨 {r.updatedAt}
                                </Tag>
                            ) : (
                                <Tag bordered={false} color="orange">
                                    처음 비밀번호 사용 중
                                </Tag>
                            ),
                    },
                    { title: '비밀번호 바꾸기', render: (_, r) => <SetPassword id={r.id} /> },
                ]}
            />
        </Card>
    );
}
