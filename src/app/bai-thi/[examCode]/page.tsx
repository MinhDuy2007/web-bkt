import { ExamPlayerToiThieu } from "@/app/bai-thi/[examCode]/thi-console";
import styles from "@/app/bai-thi/[examCode]/page.module.css";

type PageProps = {
  params: Promise<{ examCode: string }> | { examCode: string };
};

async function docExamCode(params: PageProps["params"]): Promise<string> {
  const resolved = await params;
  return (resolved?.examCode ?? "").toUpperCase();
}

export default async function BaiThiPage({ params }: PageProps) {
  const examCode = await docExamCode(params);

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.kicker}>Exam Player Tối Thiểu</p>
          <h1 className={styles.title}>Làm bài kiểm tra</h1>
          <p className={styles.subtitle}>
            Giao diện này chỉ hiển thị và gửi dữ liệu lên API server-side. Điểm số cuối cùng và trạng thái
            attempt luôn do backend quyết định.
          </p>
        </header>

        <ExamPlayerToiThieu examCode={examCode} />
      </section>
    </main>
  );
}
