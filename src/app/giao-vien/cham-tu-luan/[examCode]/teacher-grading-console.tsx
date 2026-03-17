"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/app/giao-vien/cham-tu-luan/[examCode]/page.module.css";
import type {
  AiEssayGradingSuggestionItemRecord,
  EssayManualGradingQueueItemRecord,
  GradeEssayAttemptAnswerResult,
  ReviewAiEssaySuggestionResult,
} from "@/types/exam";

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

function taoMapGoiYTheoAnswer(
  items: AiEssayGradingSuggestionItemRecord[],
): Record<string, AiEssayGradingSuggestionItemRecord[]> {
  const map: Record<string, AiEssayGradingSuggestionItemRecord[]> = {};
  for (const item of items) {
    const key = item.answer.id;
    map[key] ??= [];
    map[key].push(item);
  }

  for (const key of Object.keys(map)) {
    map[key]?.sort((left, right) =>
      right.suggestion.generatedAt.localeCompare(left.suggestion.generatedAt),
    );
  }

  return map;
}

function docNhanTrangThaiGoiY(status: AiEssayGradingSuggestionItemRecord["suggestion"]["status"]): string {
  if (status === "pending") {
    return "Đang chờ duyệt";
  }
  if (status === "accepted") {
    return "Đã chấp nhận";
  }
  if (status === "rejected") {
    return "Đã bỏ qua";
  }
  return "Đã thay thế";
}

function docClassTrangThaiGoiY(
  status: AiEssayGradingSuggestionItemRecord["suggestion"]["status"],
): string {
  if (status === "accepted") {
    return styles.suggestionStatusAccepted;
  }
  if (status === "rejected") {
    return styles.suggestionStatusRejected;
  }
  if (status === "superseded") {
    return styles.suggestionStatusSuperseded;
  }
  return styles.suggestionStatusPending;
}

function docDoTinCay(confidenceScore: number | null): string {
  if (confidenceScore === null) {
    return "Không có";
  }

  return `${Math.round(confidenceScore * 100)}%`;
}

export function ChamTuLuanToiThieu({ examCode }: Props) {
  const [dangTai, setDangTai] = useState(true);
  const [dangChamTheoAnswer, setDangChamTheoAnswer] = useState<Record<string, boolean>>({});
  const [dangSinhGoiYTheoAnswer, setDangSinhGoiYTheoAnswer] = useState<Record<string, boolean>>({});
  const [dangXuLyGoiYTheoId, setDangXuLyGoiYTheoId] = useState<Record<string, boolean>>({});
  const [loiTai, setLoiTai] = useState<string | null>(null);
  const [thongBao, setThongBao] = useState<string | null>(null);
  const [items, setItems] = useState<EssayManualGradingQueueItemRecord[]>([]);
  const [goiYTheoAnswer, setGoiYTheoAnswer] = useState<
    Record<string, AiEssayGradingSuggestionItemRecord[]>
  >({});
  const [formState, setFormState] = useState<FormState>({});
  const [taiLaiKey, setTaiLaiKey] = useState(0);

  useEffect(() => {
    let daHuy = false;
    const controller = new AbortController();

    async function taiDuLieu() {
      setDangTai(true);
      setLoiTai(null);

      try {
        const [queueResponse, goiYResponse] = await Promise.all([
          fetch(`/api/exams/manual-grading?examCode=${encodeURIComponent(examCode)}`, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/api/exams/ai-grading/suggestions?examCode=${encodeURIComponent(examCode)}`, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);
        const queueBody = (await queueResponse.json()) as ApiResponse<
          EssayManualGradingQueueItemRecord[]
        >;
        const goiYBody = (await goiYResponse.json()) as ApiResponse<AiEssayGradingSuggestionItemRecord[]>;

        if (!queueResponse.ok || !queueBody.ok) {
          throw new Error(
            queueBody.ok ? "Không thể tải danh sách cần chấm tay." : queueBody.error.message,
          );
        }
        if (!goiYResponse.ok || !goiYBody.ok) {
          throw new Error(goiYBody.ok ? "Không thể tải gợi ý chấm AI." : goiYBody.error.message);
        }

        if (daHuy) {
          return;
        }

        setItems(queueBody.data);
        setFormState(taoFormState(queueBody.data));
        setGoiYTheoAnswer(taoMapGoiYTheoAnswer(goiYBody.data));
      } catch (error) {
        if (!daHuy) {
          setLoiTai(error instanceof Error ? error.message : "Không thể tải dữ liệu chấm.");
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

  const pendingCount = items.length;
  const tongDiemToiDa = useMemo(
    () => items.reduce((sum, item) => sum + item.question.points, 0),
    [items],
  );
  const tongGoiYDangCho = useMemo(
    () =>
      Object.values(goiYTheoAnswer)
        .flat()
        .filter((item) => item.suggestion.status === "pending").length,
    [goiYTheoAnswer],
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

  async function taiLaiDuLieu(thongBaoMoi: string) {
    setThongBao(thongBaoMoi);
    setTaiLaiKey((value) => value + 1);
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

      await taiLaiDuLieu(
        `Đã cập nhật điểm tay. Pending còn lại: ${body.data.attempt.pendingManualGradingCount}.`,
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

  async function taoGoiYAI(answerId: string) {
    setThongBao(null);
    setDangSinhGoiYTheoAnswer((state) => ({
      ...state,
      [answerId]: true,
    }));

    try {
      const response = await fetch("/api/exams/ai-grading/suggestions", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          examCode,
          answerId,
        }),
      });
      const body = (await response.json()) as ApiResponse<AiEssayGradingSuggestionItemRecord>;
      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "Không thể tạo gợi ý chấm AI." : body.error.message);
      }

      await taiLaiDuLieu("Đã tạo gợi ý AI mới. Giáo viên vẫn là người quyết định điểm cuối.");
    } catch (error) {
      setThongBao(error instanceof Error ? error.message : "Không thể tạo gợi ý chấm AI.");
    } finally {
      setDangSinhGoiYTheoAnswer((state) => ({
        ...state,
        [answerId]: false,
      }));
    }
  }

  async function xuLyGoiY(
    suggestionId: string,
    action: "accept" | "reject",
  ) {
    setThongBao(null);
    setDangXuLyGoiYTheoId((state) => ({
      ...state,
      [suggestionId]: true,
    }));

    try {
      const response = await fetch(`/api/exams/ai-grading/suggestions/${suggestionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action,
        }),
      });
      const body = (await response.json()) as ApiResponse<ReviewAiEssaySuggestionResult>;
      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "Không thể xử lý gợi ý chấm AI." : body.error.message);
      }

      if (action === "accept") {
        await taiLaiDuLieu(
          `Đã chấp nhận gợi ý AI. Pending còn lại: ${body.data.attempt.pendingManualGradingCount}.`,
        );
      } else {
        await taiLaiDuLieu("Đã bỏ qua gợi ý AI. Giáo viên có thể chấm tay riêng.");
      }
    } catch (error) {
      setThongBao(error instanceof Error ? error.message : "Không thể xử lý gợi ý chấm AI.");
    } finally {
      setDangXuLyGoiYTheoId((state) => ({
        ...state,
        [suggestionId]: false,
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
            <p className={styles.summaryNote}>
              Toàn bộ queue và suggestion đều đi qua route server-side.
            </p>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Bài đang chờ chấm</span>
            <span className={styles.summaryValue}>{pendingCount}</span>
            <p className={styles.summaryNote}>
              Chỉ tính câu tự luận đã nộp và chưa có điểm manual cuối.
            </p>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Gợi ý AI đang chờ duyệt</span>
            <span className={styles.summaryValue}>{tongGoiYDangCho}</span>
            <p className={styles.summaryNote}>
              Gợi ý AI chỉ là lớp hỗ trợ. Giáo viên vẫn quyết định cuối.
            </p>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Tổng điểm tối đa trong queue</span>
            <span className={styles.summaryValue}>{tongDiemToiDa}</span>
            <p className={styles.summaryNote}>
              Giúp giáo viên nhập điểm đúng biên độ từng câu.
            </p>
          </div>
        </div>

        {thongBao ? <p className={styles.inlineMessage}>{thongBao}</p> : null}
      </section>

      {dangTai ? <div className={styles.stateCard}>Đang tải danh sách cần chấm và gợi ý AI...</div> : null}

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
        <div className={styles.stateCard}>
          Hiện không còn câu tự luận nào chờ chấm cho bài thi này.
        </div>
      ) : null}

      {!dangTai && !loiTai && items.length > 0 ? (
        <div className={styles.list}>
          {items.map((item, index) => {
            const form = formState[item.answer.id] ?? {
              manualAwardedPoints: "",
              gradingNote: "",
            };
            const goiYItems = goiYTheoAnswer[item.answer.id] ?? [];

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

                <div className={styles.answerBox}>
                  {item.answer.answerText ?? "Không có nội dung trả lời."}
                </div>

                <section className={styles.suggestionPanel}>
                  <div className={styles.suggestionPanelHeader}>
                    <div>
                      <p className={styles.summaryLabel}>AI-assisted grading</p>
                      <p className={styles.summaryNote}>
                        Gợi ý chỉ được lưu ở server và không tự cập nhật điểm cuối khi giáo viên chưa chấp nhận.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => void taoGoiYAI(item.answer.id)}
                      disabled={dangSinhGoiYTheoAnswer[item.answer.id] === true}
                    >
                      {dangSinhGoiYTheoAnswer[item.answer.id] === true
                        ? "Đang tạo gợi ý..."
                        : goiYItems.length > 0
                          ? "Tạo gợi ý mới"
                          : "Tạo gợi ý AI"}
                    </button>
                  </div>

                  {goiYItems.length === 0 ? (
                    <div className={styles.suggestionEmpty}>Chưa có gợi ý AI nào cho câu trả lời này.</div>
                  ) : (
                    <div className={styles.suggestionList}>
                      {goiYItems.map((goiY) => (
                        <article
                          key={goiY.suggestion.id}
                          className={styles.suggestionCard}
                          data-testid="ai-suggestion-item"
                        >
                          <div className={styles.suggestionHeader}>
                            <div className={styles.suggestionMeta}>
                              <span
                                className={`${styles.suggestionStatus} ${docClassTrangThaiGoiY(
                                  goiY.suggestion.status,
                                )}`}
                              >
                                {docNhanTrangThaiGoiY(goiY.suggestion.status)}
                              </span>
                              <span>Mô hình: {goiY.suggestion.modelName}</span>
                              <span>Độ tin cậy: {docDoTinCay(goiY.suggestion.confidenceScore)}</span>
                            </div>
                            <strong>{goiY.suggestion.suggestedPoints}/{goiY.question.points} điểm</strong>
                          </div>

                          <p className={styles.suggestionFeedback}>
                            {goiY.suggestion.suggestedFeedback ?? "AI chưa trả về nhận xét chi tiết."}
                          </p>

                          {goiY.suggestion.status === "pending" ? (
                            <div className={styles.actions}>
                              <button
                                type="button"
                                className={`${styles.button} ${styles.buttonPrimary}`}
                                onClick={() => void xuLyGoiY(goiY.suggestion.id, "accept")}
                                disabled={dangXuLyGoiYTheoId[goiY.suggestion.id] === true}
                              >
                                {dangXuLyGoiYTheoId[goiY.suggestion.id] === true
                                  ? "Đang xử lý..."
                                  : "Chấp nhận gợi ý"}
                              </button>
                              <button
                                type="button"
                                className={styles.button}
                                onClick={() => void xuLyGoiY(goiY.suggestion.id, "reject")}
                                disabled={dangXuLyGoiYTheoId[goiY.suggestion.id] === true}
                              >
                                Bỏ qua gợi ý
                              </button>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </section>

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
