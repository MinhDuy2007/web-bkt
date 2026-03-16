"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/app/lop-hoc/page.module.css";

type SessionUser = {
  id: string;
  roles: string[];
  accountStatus: string;
  teacherVerificationStatus: string;
};

type SessionPayload = {
  user: SessionUser;
};

type ClassItem = {
  classRecord: {
    id: string;
    classCode: string;
    educationLevel: string;
    subjectName: string;
    schoolName: string | null;
    gradeLabel: string;
    fullClassName: string;
    teacherUserId: string;
    joinCode: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  membership: {
    id: string;
    classId: string;
    userId: string;
    memberRole: "teacher" | "student";
    joinedAt: string;
    createdAt: string;
  };
};

type ApiResponse<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

function laGiaoVienDaDuyet(user: SessionUser | null): boolean {
  if (!user || user.accountStatus !== "active") {
    return false;
  }

  if (user.roles.includes("admin")) {
    return true;
  }

  return user.roles.includes("teacher") && user.teacherVerificationStatus === "approved";
}

function dinhDangNgay(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "Không xác định";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

export function QuanLyLopHocToiThieu() {
  const [dangTai, setDangTai] = useState(true);
  const [loiTai, setLoiTai] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [danhSachLop, setDanhSachLop] = useState<ClassItem[]>([]);

  const [maLop, setMaLop] = useState("");
  const [maThamGia, setMaThamGia] = useState("");
  const [dangThamGia, setDangThamGia] = useState(false);
  const [thongBaoJoin, setThongBaoJoin] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [taiLaiKey, setTaiLaiKey] = useState(0);

  useEffect(() => {
    let daHuy = false;
    const controller = new AbortController();

    async function taiDuLieu() {
      setDangTai(true);
      setLoiTai(null);

      try {
        const sessionResponse = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const sessionBody = (await sessionResponse.json()) as ApiResponse<SessionPayload>;
        if (!sessionResponse.ok || !sessionBody.ok) {
          throw new Error("Bạn cần đăng nhập để sử dụng mô-đun lớp học.");
        }

        if (daHuy) {
          return;
        }

        const user = sessionBody.data.user;
        setSessionUser(user);

        const classesResponse = await fetch("/api/classes/mine", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const classesBody = (await classesResponse.json()) as ApiResponse<ClassItem[]>;
        if (!classesResponse.ok || !classesBody.ok) {
          throw new Error(
            classesBody.ok ? "Không thể tải danh sách lớp." : classesBody.error.message,
          );
        }

        if (daHuy) {
          return;
        }

        setDanhSachLop(classesBody.data);
      } catch (error) {
        if (daHuy) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Không thể tải dữ liệu lớp học hiện tại.";
        setLoiTai(message);
      } finally {
        if (!daHuy) {
          setDangTai(false);
        }
      }
    }

    void taiDuLieu();

    return () => {
      daHuy = true;
      controller.abort();
    };
  }, [taiLaiKey]);

  const coLop = danhSachLop.length > 0;
  const coTheTaoLop = useMemo(() => laGiaoVienDaDuyet(sessionUser), [sessionUser]);

  async function xuLyThamGiaLop() {
    setThongBaoJoin(null);
    setDangThamGia(true);

    try {
      const response = await fetch("/api/classes/join", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          classCode: maLop,
          joinCode: maThamGia,
        }),
      });

      const body = (await response.json()) as ApiResponse<ClassItem>;
      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "Không thể tham gia lớp." : body.error.message);
      }

      setThongBaoJoin({
        type: "success",
        message: `Đã tham gia lớp ${body.data.classRecord.fullClassName} thành công.`,
      });
      setMaLop("");
      setMaThamGia("");
      setTaiLaiKey((oldValue) => oldValue + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tham gia lớp học.";
      setThongBaoJoin({
        type: "error",
        message,
      });
    } finally {
      setDangThamGia(false);
    }
  }

  return (
    <div className={styles.stack}>
      {coTheTaoLop ? (
        <p className={`${styles.inlineMessage} ${styles.inlineMessageSuccess}`}>
          Tài khoản của bạn đã đủ quyền tạo lớp. Dùng nút &ldquo;Mở trang tạo lớp&rdquo; ở đầu trang để
          khởi tạo lớp mới.
        </p>
      ) : (
        <p className={`${styles.inlineMessage} ${styles.inlineMessageWarn}`}>
          Tài khoản hiện tại chưa đủ điều kiện tạo lớp. Chỉ giáo viên đã được duyệt hoặc admin mới
          có quyền này.
        </p>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Tham gia lớp bằng mã</h2>
        <p className={styles.sectionText}>
          Nhập mã lớp và mã tham gia do giáo viên cung cấp.
        </p>

        <div className={styles.grid}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="join-class-code">
              Mã lớp
            </label>
            <input
              id="join-class-code"
              className={styles.input}
              placeholder="Ví dụ: CLA12BCD"
              value={maLop}
              onChange={(event) => setMaLop(event.target.value.toUpperCase())}
              disabled={dangThamGia}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="join-code">
              Mã tham gia
            </label>
            <input
              id="join-code"
              className={styles.input}
              placeholder="Ví dụ: 9H2M7KQW"
              value={maThamGia}
              onChange={(event) => setMaThamGia(event.target.value.toUpperCase())}
              disabled={dangThamGia}
            />
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled={dangThamGia || maLop.trim().length === 0 || maThamGia.trim().length === 0}
            onClick={() => void xuLyThamGiaLop()}
          >
            {dangThamGia ? "Đang xử lý..." : "Tham gia lớp"}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => setTaiLaiKey((oldValue) => oldValue + 1)}
            disabled={dangTai || dangThamGia}
          >
            {dangTai ? "Đang tải..." : "Làm mới danh sách"}
          </button>
        </div>

        {thongBaoJoin ? (
          <p
            className={`${styles.inlineMessage} ${
              thongBaoJoin.type === "success"
                ? styles.inlineMessageSuccess
                : styles.inlineMessageError
            }`}
          >
            {thongBaoJoin.message}
          </p>
        ) : null}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Danh sách lớp của tôi</h2>
        {dangTai ? <div className={styles.stateCard}>Đang tải danh sách lớp...</div> : null}

        {!dangTai && loiTai ? (
          <div className={styles.stateCard}>
            <p>{loiTai}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.button}
                onClick={() => setTaiLaiKey((oldValue) => oldValue + 1)}
              >
                Tải lại
              </button>
            </div>
          </div>
        ) : null}

        {!dangTai && !loiTai && !coLop ? (
          <div className={styles.stateCard}>
            Chưa có lớp nào trong danh sách của bạn. Hãy tham gia lớp bằng mã hoặc tạo lớp mới.
          </div>
        ) : null}

        {!dangTai && !loiTai && coLop ? (
          <div className={styles.cards}>
            {danhSachLop.map((item) => (
              <article key={item.membership.id} className={styles.card}>
                <h3 className={styles.cardTitle}>{item.classRecord.fullClassName}</h3>
                <p className={styles.meta}>
                  Mã lớp: <strong>{item.classRecord.classCode}</strong>
                </p>
                <p className={styles.meta}>
                  Môn học: {item.classRecord.subjectName} • Cấp học: {item.classRecord.educationLevel}
                </p>
                <p className={styles.meta}>
                  Vai trò của bạn:{" "}
                  <span
                    className={`${styles.pill} ${
                      item.membership.memberRole === "teacher"
                        ? styles.pillTeacher
                        : styles.pillStudent
                    }`}
                  >
                    {item.membership.memberRole === "teacher" ? "Giáo viên" : "Học sinh"}
                  </span>
                </p>
                <p className={styles.meta}>Tham gia lúc: {dinhDangNgay(item.membership.joinedAt)}</p>
                {item.membership.memberRole === "teacher" ? (
                  <p className={styles.meta}>
                    Mã tham gia lớp: <strong>{item.classRecord.joinCode}</strong>
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
