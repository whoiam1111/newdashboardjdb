import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // 다른 사이트가 이 화면을 iframe 안에 넣지 못하게 (로그인 화면 속임수 방지)
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
                ],
            },
        ];
    },
};

export default nextConfig;
