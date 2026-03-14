import Link from "next/link";
import { TaoLopHocForm } from "@/app/lop-hoc/tao/tao-lop-hoc-form";
import styles from "@/app/lop-hoc/page.module.css";

export default function TaoLopHocPage() {
  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Mô-đun lớp học</p>
          <h1 className={styles.title}>Tạo lớp học mới</h1>
          <p className={styles.subtitle}>
            Trang này chỉ chấp nhận thao tác từ giáo viên đã duyệt hoặc admin. Dữ liệu quyền được
            xác minh hoàn toàn ở backend.
          </p>
          <div className={styles.actions}>
            <Link href="/lop-hoc" className={styles.linkButton}>
              Quay lại lớp của tôi
            </Link>
          </div>
        </header>

        <TaoLopHocForm />
      </section>
    </main>
  );
}
