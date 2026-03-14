import Link from "next/link";
import { QuanLyLopHocToiThieu } from "@/app/lop-hoc/lop-hoc-console";
import styles from "@/app/lop-hoc/page.module.css";

export default function LopHocPage() {
  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Mô-đun lớp học</p>
          <h1 className={styles.title}>Lớp học của tôi</h1>
          <p className={styles.subtitle}>
            Đây là khung nền tối thiểu cho giai đoạn đầu: xem lớp đã tham gia, tham gia lớp bằng mã
            và điều hướng sang trang tạo lớp cho giáo viên đã duyệt.
          </p>
          <div className={styles.actions}>
            <Link href="/lop-hoc/tao" className={styles.linkButton}>
              Mở trang tạo lớp
            </Link>
          </div>
        </header>

        <QuanLyLopHocToiThieu />
      </section>
    </main>
  );
}
