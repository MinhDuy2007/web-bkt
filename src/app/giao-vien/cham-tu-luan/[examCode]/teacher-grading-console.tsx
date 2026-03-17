"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/app/giao-vien/cham-tu-luan/[examCode]/page.module.css";
import type { EssayManualGradingQueueItemRecord, GradeEssayAttemptAnswerResult } from "@/types/exam";

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

type Props = {
  examCode: string;
};

type FormState = Record<
  string,
  {
    manualAwardedPoints: string;
    gradingNote: string;
  }
>;

function taoFormState(items: EssayManualGradingQueueItemRecord[]): FormState {
  return items.reduce<FormState>((state, item) => {
    state[item.answer.id] = {
      manualAwardedPoints:
        item.answer.manualAwardedPoints !== null ? String(item.answer.manualAwardedPoints) : "",
      gradingNote: item.answer.gradingNote ?? "",
    };
    return state;
  }, {});
}

export function ChamTuLuanToiThieu({ examCode }: Props) {
  const [dangTai, setDangTai] = useState(true);
  const [dangChamTheoAnswer, setDangChamTheoAnswer] = useState<Record<string, boolean>>({});
  const [loiTai, setLoiTai] = useState<string | null>(null);
  const [thongBao, setThongBao] = useState<string | null>(null);
  const [items, setItems] = useState<EssayManualGradingQueueItemRecord[]>([]);
  const [formState, setFormState] = useState<FormState>({});
  const [taiLaiKey, setTaiLaiKey] = useState(0);

  useEffect(() => {
    let daHuy = false;
    const controller = new AbortController();

    async function taiQueue() {
      setDangTai(true);
      setLoiTai(null);

      try {
        const response = await fetch(
          `/api/exams/manual-grading?examCode=${encodeURIComponent(examCode)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const body = (await response.json()) as ApiResponse<EssayManualGradingQueueItemRecord[]>;
        if (!response.ok || !body.ok) {
          throw new Error(body.ok ? "Không thể tải danh sách cần chấm tay." : body.error.message);
        }

        if (daHuy) {
          return;
        }

        setItems(body.data);
        setFormState(taoFormState(body.data));
      } catch (error) {
        if (!daHuy) {
          setLoiTai(
            error instanceof Error ? error.message : "Không thể tải danh sách cần chấm tay.",
          );
        }
      } finally {
        if (!daHuy) {
          setDangTai(false);
        }
      }
    }

    void taiQueue();

    return () => {
      daHuy = true;
      controller.abort();
    };
  }, [examCode, taiLaiKey]);

  const pendingCount = items.length;
  const tongDiemToiDa = useMemo(
    () => items.reduce((sum, item) => sum + item.question.points, 0),
    [items],
  );

  function capNhatForm(answerId: string, field: "manualAwardedPoints" | "gradingNote", value: string) {
    setFormState((state) => ({
      ...state,
      [answerId]: {
        manualAwardedPoints: state[answerId]?.manualAwardedPoints ?? "",
        gradingNote: state[answerId]?.gradingNote ?? "",
        [field]: value,
      },
    }));
  }

  async function xuLyCham(answerId: string) {
    const current = formState[answerId];
    if (!current) {
      return;
    }

    setThongBao(null);
    setDangChamTheoAnswer((state) => ({
      ...state,
      [answerId]: true,
    }));

    try {
      const numericScore = Number(current.manualAwardedPoints);
      const response = await fetch(`/api/exams/manual-grading/${answerId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          manualAwardedPoints: numericScore,
          gradingNote: current.gradingNote.trim() ? current.gradingNote : null,
        }),
      });
      const body = (await response.json()) as ApiResponse<GradeEssayAttemptAnswerResult>;
      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "Không thể chấm tay câu tự luận." : body.error.message);
      }

      setItems((state) => state.filter((item) => item.answer.id !== answerId));
      setThongBao(
        `Đã cập nhật điểm tay cho một câu tự luận. Pending còn lại: ${body.data.attempt.pendingManualGradingCount}.`,
      );
    } catch (error) {
      setThongBao(error instanceof Error ? error.message : "Không thể chấm tay câu tự luận.");
    } finally {
      setDangChamTheoAnswer((state) => ({
        ...state,
        [answerId]: false,
      }));
    }
  }

  return (
    <div className={styles.stack} data-testid="teacher-grading-root">
      <section className={styles.summaryCard}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Mã bài thi</span>
            <span className={styles.summaryValue}>{examCode}</span>
            <p className={styles.summaryNote}>Dùng route admin/teacher phía server để đọc queue.</p>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Bài đang chờ chấm</span>
            <span className={styles.summaryValue}>{pendingCount}</span>
            <p className={styles.summaryNote}>Chỉ tính câu tự luận đã nộp và còn thiếu manual grading.</p>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Tổng điểm tối đa trong queue</span>
            <span className={styles.summaryValue}>{tongDiemToiDa}</span>
            <p className={styles.summaryNote}>Giúp giáo viên nhập điểm trong đúng biên độ từng câu.</p>
          </div>
        </div>

        {thongBao ? <p className={styles.inlineMessage}>{thongBao}</p> : null}
      </section>

      {dangTai ? <div className={styles.stateCard}>Đang tải danh sách câu tự luận cần chấm...</div> : null}

      {!dangTai && loiTai ? (
        <div className={styles.stateCard}>
          <p>{loiTai}</p>
          <button
            type="button"
            className={styles.button}
            onClick={() => setTaiLaiKey((value) => value + 1)}
          >
            Tải lại
          </button>
        </div>
      ) : null}

      {!dangTai && !loiTai && items.length === 0 ? (
        <div className={styles.stateCard}>Hiện không còn câu tự luận nào chờ chấm cho bài thi này.</div>
      ) : null}

      {!dangTai && !loiTai && items.length > 0 ? (
        <div className={styles.list}>
          {items.map((item, index) => {
            const form = formState[item.answer.id] ?? {
              manualAwardedPoints: "",
              gradingNote: "",
            };

            return (
              <article key={item.answer.id} className={styles.card} data-testid="manual-grade-item">
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.cardIndex}>Bài #{index + 1}</p>
                    <h3 className={styles.cardTitle}>{item.question.promptText}</h3>
                    <p className={styles.cardMeta}>
                      Học sinh: {item.student.displayName ?? "Chưa có tên hiển thị"}
                      {item.student.email ? ` · ${item.student.email}` : ""}
                    </p>
                  </div>
                  <span className={styles.pointsTag}>Tối đa {item.question.points} điểm</span>
                </div>

                <div className={styles.answerBox}>{item.answer.answerText ?? "Không có nội dung trả lời."}</div>

                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Điểm chấm tay</span>
                    <input
                      type="number"
                      min={0}
                      max={item.question.points}
                      step="0.25"
                      className={styles.input}
                      value={form.manualAwardedPoints}
                      onChange={(event) =>
                        capNhatForm(item.answer.id, "manualAwardedPoints", event.target.value)
                      }
                      disabled={dangChamTheoAnswer[item.answer.id] === true}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Ghi chú chấm tay</span>
                    <textarea
                      className={styles.textarea}
                      value={form.gradingNote}
                      onChange={(event) =>
                        capNhatForm(item.answer.id, "gradingNote", event.target.value)
                      }
                      disabled={dangChamTheoAnswer[item.answer.id] === true}
                      placeholder="Ghi chú ngắn gọn để học sinh xem lại sau khi chấm."
                    />
                  </label>
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.buttonPrimary}`}
                    onClick={() => void xuLyCham(item.answer.id)}
                    disabled={
                      dangChamTheoAnswer[item.answer.id] === true ||
                      form.manualAwardedPoints.trim().length === 0
                    }
                  >
                    {dangChamTheoAnswer[item.answer.id] === true ? "Đang cập nhật..." : "Lưu điểm tay"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
