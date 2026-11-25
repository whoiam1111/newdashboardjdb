// 카드 머리 제목: 선 아이콘 + 글자 (참고 디자인의 카드 머리)
export const CardTitle = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
    <span className="card-title">
        {icon}
        {children}
    </span>
);

// 숫자 타일: 작은 회색 이름 + 큰 숫자 (+ 뒤에 흐린 글자)
export const Tile = ({ label, value, suffix }: { label: React.ReactNode; value: React.ReactNode; suffix?: string }) => (
    <div className="tile">
        <div className="tile-label">{label}</div>
        <div className="tile-value">
            {value}
            {suffix && <small>{suffix}</small>}
        </div>
    </div>
);
