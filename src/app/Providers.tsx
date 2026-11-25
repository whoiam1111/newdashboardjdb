'use client';
import { ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';

// 참고 디자인(AlignUI) 색·모서리를 antd 전체에
export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ConfigProvider
            locale={koKR}
            theme={{
                token: {
                    colorPrimary: '#7d52f4',
                    colorText: '#0e121b',
                    colorTextSecondary: '#525866',
                    colorTextTertiary: '#99a0ae',
                    colorBorder: '#e1e4ea',
                    colorBorderSecondary: '#ebebeb',
                    colorBgLayout: '#f5f7fa',
                    borderRadius: 10,
                    fontFamily: "'Pretendard Variable', Pretendard, Inter, -apple-system, 'Segoe UI', sans-serif",
                    fontSize: 14,
                },
                components: {
                    Card: { borderRadiusLG: 16, headerFontSize: 16, headerHeight: 60 },
                    Table: {
                        headerBg: '#f5f7fa',
                        headerColor: '#525866',
                        headerSplitColor: 'transparent',
                        borderColor: '#ebebeb',
                        rowHoverBg: '#fafafb',
                        headerBorderRadius: 10,
                    },
                    Button: { defaultShadow: 'none', primaryShadow: 'none', fontWeight: 500 },
                    Segmented: { trackBg: '#f5f7fa', itemSelectedColor: '#0e121b', itemColor: '#99a0ae' },
                    Tag: { defaultBg: '#f5f7fa', defaultColor: '#525866' },
                    Input: { activeShadow: '0 0 0 3px #f2eeff' },
                },
            }}
        >
            {children}
        </ConfigProvider>
    );
}
