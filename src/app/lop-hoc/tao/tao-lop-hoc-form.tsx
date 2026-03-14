"use client";

import { useEffect, useState } from "react";
import styles from "@/app/lop-hoc/page.module.css";

type SessionUser = {
  roles: string[];
  accountStatus: string;
  teacherVerificationStatus: string;
};

type SessionPayload = {
  user: SessionUser;
};

type TaoLopThanhCongPayload = {
  classRecord: {
    id: string;
    classCode: string;
    joinCode: string;
    fullClassName: string;
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

export function TaoLopHocForm() {
  const [dangTaiQuyen, setDangTaiQuyen] = useState(true);
  const [coQuyen, setCoQuyen] = useState(false);
  const [loiQuyen, setLoiQuyen] = useState<string | null>(null);

  const [educationLevel, setEducationLevel] = useState("THPT");
  const [subjectName, setSubjectName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [fullClassName, setFullClassName] = useState("");

  const [dangTao, setDangTao] = useState(false);
  const [thongBao, setThongBao] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [ketQuaTao, setKetQuaTao] = useState<TaoLopThanhCongPayload["classRecord"] | null>(null);

  useEffect(() => {
    let daHuy = false;
    const controller = new AbortController();

    async function taiQuyen() {
      setDangTaiQuyen(true);
      setLoiQuyen(null);

      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as ApiResponse<SessionPayload>;
        if (!response.ok || !body.ok) {
          throw new Error("Bạn cần đăng nhập để tạo lớp.");
        }

        if (daHuy) {
          return;
        }

        const duQuyen = laGiaoVienDaDuyet(body.data.user);
        setCoQuyen(duQuyen);
        if (!duQuyen) {
          setLoiQuyen("Tài khoản hiện tại chưa đủ điều kiện tạo lớp học.");
        }
      } catch (error) {
        if (daHuy) {
          return;
        }

        const message = error instanceof Error ? error.message : "Không thể xác minh quyền hiện tại.";
        setLoiQuyen(message);
        setCoQuyen(false);
      } finally {
        if (!daHuy) {
          setDangTaiQuyen(false);
        }
      }
    }

    void taiQuyen();

    return () => {
      daHuy = true;
      controller.abort();
    };
  }, []);

  async function xuLyTaoLop() {
    setDangTao(true);
    setThongBao(null);
    setKetQuaTao(null);

    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          educationLevel,
          subjectName,
          schoolName,
          gradeLabel,
          fullClassName,
        }),
      });

      const body = (await response.json()) as ApiResponse<TaoLopThanhCongPayload>;
      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "Không thể tạo lớp học." : body.error.message);
      }

      setKetQuaTao(body.data.classRecord);
      setThongBao({
        type: "success",
        message: `Đã tạo lớp "${body.data.classRecord.fullClassName}" thành công.`,
      });
      setSubjectName("");
      setSchoolName("");
      setGradeLabel("");
      setFullClassName("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tạo lớp học.";
      setThongBao({
        type: "error",
        message,
      });
    } finally {
      setDangTao(false);
    }
  }

  if (dangTaiQuyen) {
    return <section className={styles.stateCard}>Đang kiểm tra quyền tạo lớp...</section>;
  }

  if (!coQuyen) {
    return (
      <section className={styles.stateCard}>
        <p>{loiQuyen ?? "Bạn không có quyền tạo lớp học."}</p>
      </section>
    );
  }

  return (
    <div className={styles.stack}>
      {thongBao ? (
        <p
          className={`${styles.inlineMessage} ${
            thongBao.type === "success"
              ? styles.inlineMessageSuccess
              : styles.inlineMessageError
          }`}
        >
          {thongBao.message}
        </p>
      ) : null}

      {ketQuaTao ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Thông tin lớp vừa tạo</h2>
          <p className={styles.meta}>
            Mã lớp: <strong>{ketQuaTao.classCode}</strong>
          </p>
          <p className={styles.meta}>
            Mã tham gia: <strong>{ketQuaTao.joinCode}</strong>
          </p>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Thông tin lớp học</h2>
        <div className={styles.grid}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="education-level">
              Cấp học
            </label>
            <select
              id="education-level"
              className={styles.select}
              value={educationLevel}
              onChange={(event) => setEducationLevel(event.target.value)}
              disabled={dangTao}
            >
              <option value="THCS">THCS</option>
              <option value="THPT">THPT</option>
              <option value="Đại học">Đại học</option>
              <option value="Khác">Khác</option>
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="subject-name">
              Môn học
            </label>
            <input
              id="subject-name"
              className={styles.input}
              value={subjectName}
              onChange={(event) => setSubjectName(event.target.value)}
              placeholder="Ví dụ: Toán nâng cao"
              disabled={dangTao}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="grade-label">
              Khối/lớp
            </label>
            <input
              id="grade-label"
              className={styles.input}
              value={gradeLabel}
              onChange={(event) => setGradeLabel(event.target.value)}
              placeholder="Ví dụ: Khối 11A"
              disabled={dangTao}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="school-name">
              Trường học (tùy chọn)
            </label>
            <input
              id="school-name"
              className={styles.input}
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
              placeholder="Ví dụ: THPT Trần Phú"
              disabled={dangTao}
            />
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label} htmlFor="full-class-name">
            Tên đầy đủ của lớp
          </label>
          <input
            id="full-class-name"
            className={styles.input}
            value={fullClassName}
            onChange={(event) => setFullClassName(event.target.value)}
            placeholder="Ví dụ: Lớp ôn thi HSG Toán 11A - Học kỳ 2"
            disabled={dangTao}
          />
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.buttonPrimary}`}
            disabled={
              dangTao ||
              subjectName.trim().length === 0 ||
              gradeLabel.trim().length === 0 ||
              fullClassName.trim().length === 0
            }
            onClick={() => void xuLyTaoLop()}
          >
            {dangTao ? "Đang tạo..." : "Tạo lớp học"}
          </button>
        </div>
      </section>
    </div>
  );
}
