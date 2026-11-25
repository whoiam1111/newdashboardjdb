import { AntdRegistry } from '@ant-design/nextjs-registry';
import Providers from './Providers';
import './globals.css';

export const metadata = { title: '발굴 명단' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko">
            <head>
                {/* 한글 글꼴 (참고 디자인의 Inter 와 비슷한 Pretendard) */}
                <link
                    rel="stylesheet"
                    href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
                />
            </head>
            <body>
                <AntdRegistry>
                    <Providers>{children}</Providers>
                </AntdRegistry>
            </body>
        </html>
    );
}
