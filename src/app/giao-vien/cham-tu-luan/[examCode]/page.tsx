import { ChamTuLuanToiThieu } from "@/app/giao-vien/cham-tu-luan/[examCode]/teacher-grading-console";
import styles from "@/app/giao-vien/cham-tu-luan/[examCode]/page.module.css";

type PageProps = {
  params: Promise<{ examCode: string }> | { examCode: string };
};

async function docExamCode(params: PageProps["params"]): Promise<string> {
  const resolved = await params;
  return (resolved?.examCode ?? "").toUpperCase();
}

export default async function ChamTuLuanPage({ params }: PageProps) {
  const examCode = await docExamCode(params);

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <p className={styles.kicker}>Teacher Review Console</p>
          <h1 className={styles.title}>Chấm tự luận và duyệt gợi ý AI</h1>
          <p className={styles.subtitle}>
            Màn hình này chỉ dùng route server-side để đọc queue, tạo gợi ý AI, và cập nhật điểm
            cuối sau khi giáo viên chấp nhận hoặc chấm tay. Frontend không tự tính lại điểm cuối.
          </p>
        </header>

        <ChamTuLuanToiThieu examCode={examCode} />
      </section>
    </main>
  );
}
