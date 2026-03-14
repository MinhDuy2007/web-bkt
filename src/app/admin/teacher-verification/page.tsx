import { headers } from "next/headers";
import { coPhaiAdmin } from "@/server/auth/permissions";
import { layPhienDangNhap } from "@/server/auth/service";
import { BangDieuKhienDuyetXacMinhGiaoVien } from "@/app/admin/teacher-verification/review-console";
import styles from "@/app/admin/teacher-verification/page.module.css";

function laySessionCookieToken(rawCookie: string | null): string | null {
  if (!rawCookie) {
    return null;
  }

  const segments = rawCookie.split(";").map((item) => item.trim());
  for (const segment of segments) {
    if (!segment.includes("=")) {
      continue;
    }

    const [cookieName, cookieValue] = segment.split("=");
    if (cookieName === "session_token" && cookieValue) {
      return decodeURIComponent(cookieValue);
    }
  }

  return null;
}

export default async function AdminTeacherVerificationPage() {
  const requestHeaders = await headers();
  const sessionToken = laySessionCookieToken(requestHeaders.get("cookie"));
  const session = sessionToken ? await layPhienDangNhap(sessionToken) : null;
  const laAdmin = coPhaiAdmin(session?.user ?? null);

  return (
    <main className={styles.page}>
      <section className={styles.container}>
        <header className={styles.header}>
          <p className={styles.kicker}>Khu vực quản trị</p>
          <h1 className={styles.title}>Duyệt xác minh giáo viên</h1>
          <p className={styles.subtitle}>
            Danh sách này chỉ dành cho quản trị viên để xem và xử lý yêu cầu xác minh giáo viên.
            Mọi thay đổi quyền đều được khóa ở backend và ghi nhật ký audit.
          </p>
        </header>

        {laAdmin ? (
          <BangDieuKhienDuyetXacMinhGiaoVien />
        ) : (
          <section className={styles.noticeCard}>
            <h2 className={styles.noticeTitle}>Bạn không có quyền truy cập.</h2>
            <p className={styles.noticeText}>
              Chỉ tài khoản admin đã đăng nhập mới được sử dụng trang duyệt xác minh giáo viên.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
