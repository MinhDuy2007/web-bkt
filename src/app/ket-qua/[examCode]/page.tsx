import { KetQuaExamToiThieu } from "@/app/ket-qua/[examCode]/ket-qua-console";
import styles from "@/app/ket-qua/[examCode]/page.module.css";

type PageProps = {
  params: Promise<{ examCode: string }> | { examCode: string };
};

async function docExamCode(params: PageProps["params"]): Promise<string> {
  const resolved = await params;
  return (resolved?.examCode ?? "").toUpperCase();
}

export default async function KetQuaBaiThiPage({ params }: PageProps) {
  const examCode = await docExamCode(params);

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.kicker}>Kết quả bài thi</p>
          <h1 className={styles.title}>Xem kết quả và review attempt</h1>
          <p className={styles.subtitle}>
            Trang này chỉ hiển thị dữ liệu chấm điểm và trạng thái attempt do máy chủ trả về.
            Frontend không tự tính lại điểm cuối cùng.
          </p>
        </header>

        <KetQuaExamToiThieu examCode={examCode} />
      </section>
    </main>
  );
}
