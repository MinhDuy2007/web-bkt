"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  docNhanChamTungCau,
  docNhanDiemTuDong,
  docTraLoiDeReview,
  xacDinhCheDoKetQua,
} from "@/app/ket-qua/[examCode]/result-model";
import styles from "@/app/ket-qua/[examCode]/page.module.css";
import type { StudentExamResultRecord } from "@/types/exam";

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

type KetQuaExamProps = {
  examCode: string;
};

function dinhDangNgay(iso: string | null): string {
  if (!iso) {
    return "Chưa có";
  }

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

export function KetQuaExamToiThieu({ examCode }: KetQuaExamProps) {
  const [dangTai, setDangTai] = useState(true);
  const [loiTai, setLoiTai] = useState<string | null>(null);
  const [duLieu, setDuLieu] = useState<StudentExamResultRecord | null>(null);
  const [taiLaiKey, setTaiLaiKey] = useState(0);

  useEffect(() => {
    let daHuy = false;
    const controller = new AbortController();

    async function taiDuLieu() {
      setDangTai(true);
      setLoiTai(null);

      try {
        const response = await fetch(`/api/exams/result?examCode=${encodeURIComponent(examCode)}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as ApiResponse<StudentExamResultRecord>;
        if (!response.ok || !body.ok) {
          throw new Error(body.ok ? "Không thể tải kết quả bài thi." : body.error.message);
        }

        if (!daHuy) {
          setDuLieu(body.data);
        }
      } catch (error) {
        if (!daHuy) {
          const message = error instanceof Error ? error.message : "Không thể tải kết quả bài thi.";
          setLoiTai(message);
        }
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
  }, [examCode, taiLaiKey]);

  const cheDo = xacDinhCheDoKetQua(duLieu?.attempt ?? null);

  return (
    <div className={styles.stack} data-testid="exam-result-root">
      {dangTai ? <div className={styles.stateCard}>Đang tải dữ liệu kết quả bài thi...</div> : null}

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
            <Link className={styles.buttonLink} href={`/bai-thi/${examCode}`}>
              Quay lại bài thi
            </Link>
          </div>
        </div>
      ) : null}

      {!dangTai && !loiTai && duLieu ? (
        <>
          <section className={styles.heroCard}>
            <div className={styles.heroHeader}>
              <div>
                <p className={styles.heroCode}>Mã bài thi: {duLieu.exam.examCode}</p>
                <h2 className={styles.heroTitle}>{duLieu.exam.title}</h2>
                <p className={styles.heroDescription}>
                  {duLieu.exam.description ?? "Bài thi này chưa có mô tả chi tiết."}
                </p>
              </div>
              <div className={styles.statusGroup}>
                {cheDo === "submitted" ? (
                  <span className={`${styles.pill} ${styles.pillSubmitted}`}>Đã nộp bài</span>
                ) : null}
                {cheDo === "in_progress" ? (
                  <span className={`${styles.pill} ${styles.pillProgress}`}>Chưa nộp bài</span>
                ) : null}
                {cheDo === "not_started" ? (
                  <span className={`${styles.pill} ${styles.pillMuted}`}>Chưa có attempt</span>
                ) : null}
              </div>
            </div>
          </section>

          {cheDo === "not_started" ? (
            <section className={styles.stateCard}>
              <p>Bạn chưa có attempt cho bài thi này nên chưa có dữ liệu kết quả để review.</p>
              <div className={styles.actions}>
                <Link className={`${styles.buttonLink} ${styles.buttonPrimary}`} href={`/bai-thi/${examCode}`}>
                  Vào bài thi
                </Link>
              </div>
            </section>
          ) : null}

          {cheDo !== "not_started" ? (
            <section className={styles.summaryCard}>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Trạng thái attempt</span>
                  <span className={styles.summaryValue}>{duLieu.attempt?.status ?? "Không xác định"}</span>
                  <p className={styles.summaryNote}>Nộp lúc: {dinhDangNgay(duLieu.summary.submittedAt)}</p>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Điểm chấm tự động</span>
                  <span className={styles.summaryValue}>{docNhanDiemTuDong(duLieu.summary)}</span>
                  <p className={styles.summaryNote}>Frontend chỉ hiển thị dữ liệu server trả về.</p>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Câu đã lưu</span>
                  <span className={styles.summaryValue}>
                    {duLieu.summary.answeredQuestionCount}/{duLieu.summary.totalQuestionCount}
                  </span>
                  <p className={styles.summaryNote}>Tính theo answer đã được lưu trên máy chủ.</p>
                </div>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>Phần chờ chấm tay</span>
                  <span className={styles.summaryValue}>{duLieu.summary.pendingManualGradingCount}</span>
                  <p className={styles.summaryNote}>Các câu tự luận chưa được AI grading trong task này.</p>
                </div>
              </div>

              {cheDo === "in_progress" ? (
                <div className={styles.actions}>
                  <p className={styles.note}>
                    Attempt này chưa nộp, nên đây chưa phải kết quả hoàn chỉnh. Bạn có thể quay lại bài thi để tiếp tục làm hoặc nộp bài.
                  </p>
                  <Link className={`${styles.buttonLink} ${styles.buttonPrimary}`} href={`/bai-thi/${examCode}`}>
                    Tiếp tục làm bài
                  </Link>
                </div>
              ) : null}
            </section>
          ) : null}

          {cheDo !== "not_started" ? (
            <section className={styles.stack}>
              {duLieu.reviewItems.length === 0 ? (
                <div className={styles.stateCard}>Chưa có dữ liệu câu hỏi hoặc câu trả lời để review.</div>
              ) : null}

              {duLieu.reviewItems.length > 0 ? (
                <div className={styles.reviewList}>
                  {duLieu.reviewItems.map((item, index) => (
                    <article
                      key={item.question.id}
                      className={styles.reviewCard}
                      data-testid="review-item"
                    >
                      <div className={styles.reviewHeader}>
                        <div>
                          <p className={styles.reviewIndex}>Câu {index + 1}</p>
                          <h3 className={styles.reviewTitle}>{item.question.promptText}</h3>
                        </div>
                        <div className={styles.reviewMeta}>
                          <span className={styles.tag}>{item.question.questionType}</span>
                          <span className={styles.tag}>{item.question.points} điểm</span>
                        </div>
                      </div>

                      <p className={styles.answerBox}>{docTraLoiDeReview(item)}</p>
                      <p className={styles.note}>{docNhanChamTungCau(item, cheDo === "submitted")}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
