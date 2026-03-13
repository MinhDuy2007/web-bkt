const moduleSeeds = [
  "Định danh và phân quyền",
  "Lớp học và đề thi",
  "Chấm điểm và hàng đợi AI",
  "Coin, gói dịch vụ và thanh toán",
  "Theo dõi vận hành và nhật ký bảo mật",
];

export default function HomePage() {
  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
      }}
    >
      <section
        style={{
          width: "min(920px, 100%)",
          border: "1px solid var(--color-border)",
          background: "linear-gradient(160deg, rgba(20, 184, 166, 0.12), rgba(15, 23, 42, 0.92))",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
          padding: "28px",
        }}
      >
        <p style={{ margin: 0, color: "var(--color-accent)", fontWeight: 700 }}>
          web-bkt • Task 1
        </p>
        <h1 style={{ marginTop: 12, marginBottom: 8 }}>Nền tảng tối thiểu đã sẵn sàng để đi tiếp</h1>
        <p style={{ marginTop: 0, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
          Mốc này tập trung khóa khung dự án để mở rộng theo từng module nghiệp vụ, không triển khai
          nóng các tính năng lớn ở bước đầu.
        </p>

        <div
          style={{
            display: "grid",
            gap: "12px",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            marginTop: "20px",
          }}
        >
          {moduleSeeds.map((moduleSeed) => (
            <article
              key={moduleSeed}
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "12px",
                background: "var(--color-bg-elevated)",
                padding: "14px",
              }}
            >
              <strong>{moduleSeed}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
