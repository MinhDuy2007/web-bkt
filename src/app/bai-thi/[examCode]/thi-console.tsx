"use client";

import { useEffect, useState } from "react";
import {
  coThayDoiChuaLuu,
  docDanhSachLuaChon,
  taoBanDoTraLoiBanDau,
  xacDinhLoaiInputLamBai,
} from "@/app/bai-thi/[examCode]/exam-player-model";
import styles from "@/app/bai-thi/[examCode]/page.module.css";
import type {
  ClassExamAttemptAnswerRecord,
  ClassExamQuestionRecord,
  StudentExamPlayerRecord,
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

type SaveAnswerResponse = {
  answer: ClassExamAttemptAnswerRecord;
  question: ClassExamQuestionRecord;
};

type SubmitResponse = {
  attempt: {
    id: string;
    status: string;
    submittedAt: string | null;
    autoGradedScore: number | null;
    maxAutoGradedScore: number | null;
    pendingManualGradingCount: number;
  };
  scoreSummary: {
    awardedScore: number;
    maxAutoGradableScore: number;
    pendingManualGradingCount: number;
  };
};

type ExamPlayerProps = {
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

export function ExamPlayerToiThieu({ examCode }: ExamPlayerProps) {
  const [dangTai, setDangTai] = useState(true);
  const [dangBatDau, setDangBatDau] = useState(false);
  const [dangNop, setDangNop] = useState(false);
  const [loiTai, setLoiTai] = useState<string | null>(null);
  const [thongBao, setThongBao] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [duLieuPlayer, setDuLieuPlayer] = useState<StudentExamPlayerRecord | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<Record<string, string>>({});
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [dangLuuTheoQuestion, setDangLuuTheoQuestion] = useState<Record<string, boolean>>({});
  const [taiLaiKey, setTaiLaiKey] = useState(0);

  useEffect(() => {
    let daHuy = false;
    const controller = new AbortController();

    async function taiDuLieu() {
      setDangTai(true);
      setLoiTai(null);

      try {
        const response = await fetch(`/api/exams/player?examCode=${encodeURIComponent(examCode)}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as ApiResponse<StudentExamPlayerRecord>;
        if (!response.ok || !body.ok) {
          throw new Error(body.ok ? "Không thể tải dữ liệu bài thi." : body.error.message);
        }

        if (daHuy) {
          return;
        }

        const answerMap = taoBanDoTraLoiBanDau(body.data.questions, body.data.answers);
        setDuLieuPlayer(body.data);
        setSavedAnswers(answerMap);
        setDraftAnswers(answerMap);
      } catch (error) {
        if (daHuy) {
          return;
        }

        const message = error instanceof Error ? error.message : "Không thể tải dữ liệu bài thi.";
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
  }, [examCode, taiLaiKey]);

  async function xuLyBatDau() {
    setDangBatDau(true);
    setThongBao(null);

    try {
      const response = await fetch("/api/exams/start", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          examCode,
        }),
      });
      const body = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "Không thể bắt đầu bài thi." : body.error.message);
      }

      setThongBao({
        type: "info",
        message: "Đã tạo attempt. Hệ thống đang tải danh sách câu hỏi.",
      });
      setTaiLaiKey((oldValue) => oldValue + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể bắt đầu bài thi.";
      setThongBao({
        type: "error",
        message,
      });
    } finally {
      setDangBatDau(false);
    }
  }

  async function xuLyLuuCauTraLoi(questionId: string) {
    if (!duLieuPlayer?.attempt) {
      return;
    }

    setDangLuuTheoQuestion((oldValue) => ({
      ...oldValue,
      [questionId]: true,
    }));
    setThongBao(null);

    try {
      const response = await fetch("/api/exams/answers", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          attemptId: duLieuPlayer.attempt.id,
          questionId,
          answerText: draftAnswers[questionId]?.trim() ? draftAnswers[questionId] : null,
          answerJson: {},
        }),
      });
      const body = (await response.json()) as ApiResponse<SaveAnswerResponse>;
      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "Không thể lưu câu trả lời." : body.error.message);
      }

      const nextValue = body.data.answer.answerText ?? "";
      setSavedAnswers((oldValue) => ({
        ...oldValue,
        [questionId]: nextValue,
      }));
      setDraftAnswers((oldValue) => ({
        ...oldValue,
        [questionId]: nextValue,
      }));
      setThongBao({
        type: "success",
        message: "Đã lưu câu trả lời vào máy chủ.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể lưu câu trả lời.";
      setThongBao({
        type: "error",
        message,
      });
      if (message.includes("nộp")) {
        setTaiLaiKey((oldValue) => oldValue + 1);
      }
    } finally {
      setDangLuuTheoQuestion((oldValue) => ({
        ...oldValue,
        [questionId]: false,
      }));
    }
  }

  async function xuLyNopBai() {
    if (!duLieuPlayer?.attempt) {
      return;
    }

    setDangNop(true);
    setThongBao(null);

    try {
      const response = await fetch("/api/exams/submit", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          attemptId: duLieuPlayer.attempt.id,
        }),
      });
      const body = (await response.json()) as ApiResponse<SubmitResponse>;
      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "Không thể nộp bài." : body.error.message);
      }

      setThongBao({
        type: "success",
        message:
          body.data.scoreSummary.pendingManualGradingCount > 0
            ? "Đã nộp bài. Hệ thống đã khóa chỉnh sửa và đang chờ chấm tay cho phần tự luận."
            : "Đã nộp bài thành công. Hệ thống đã khóa chỉnh sửa.",
      });
      setTaiLaiKey((oldValue) => oldValue + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể nộp bài.";
      setThongBao({
        type: "error",
        message,
      });
    } finally {
      setDangNop(false);
    }
  }

  function capNhatDraft(questionId: string, value: string) {
    setDraftAnswers((oldValue) => ({
      ...oldValue,
      [questionId]: value,
    }));
  }

  function renderQuestionInput(question: ClassExamQuestionRecord) {
    const currentValue = draftAnswers[question.id] ?? "";
    const inputType = xacDinhLoaiInputLamBai(question.questionType);
    const disabled = Boolean(duLieuPlayer?.isLocked || dangNop || dangLuuTheoQuestion[question.id]);

    if (inputType === "multiple_choice_single") {
      const options = docDanhSachLuaChon(question);
      return (
        <div className={styles.optionList}>
          {options.map((option) => (
            <label key={option} className={styles.optionItem}>
              <input
                type="radio"
                name={question.id}
                checked={currentValue === option}
                onChange={() => capNhatDraft(question.id, option)}
                disabled={disabled}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    if (inputType === "true_false") {
      return (
        <div className={styles.optionList}>
          {[
            { value: "true", label: "Đúng" },
            { value: "false", label: "Sai" },
          ].map((option) => (
            <label key={option.value} className={styles.optionItem}>
              <input
                type="radio"
                name={question.id}
                checked={currentValue === option.value}
                onChange={() => capNhatDraft(question.id, option.value)}
                disabled={disabled}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );
    }

    if (inputType === "essay_placeholder") {
      return (
        <textarea
          className={styles.textarea}
          value={currentValue}
          onChange={(event) => capNhatDraft(question.id, event.target.value)}
          disabled={disabled}
          placeholder="Nhập phần trả lời tự luận. Phần này chưa chấm tự động ở task hiện tại."
        />
      );
    }

    return (
      <input
        className={styles.input}
        value={currentValue}
        onChange={(event) => capNhatDraft(question.id, event.target.value)}
        disabled={disabled}
        placeholder="Nhập câu trả lời ngắn"
      />
    );
  }

  const coAttempt = Boolean(duLieuPlayer?.attempt);
  const coQuestion = (duLieuPlayer?.questions.length ?? 0) > 0;
  const attempt = duLieuPlayer?.attempt ?? null;

  return (
    <div className={styles.stack} data-testid="exam-player-root">
      {dangTai ? <div className={styles.stateCard}>Đang tải dữ liệu bài thi...</div> : null}

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

      {!dangTai && !loiTai && duLieuPlayer ? (
        <>
          <section className={styles.heroCard}>
            <div className={styles.heroHeader}>
              <div>
                <p className={styles.heroCode}>Mã bài thi: {duLieuPlayer.exam.examCode}</p>
                <h2 className={styles.heroTitle}>{duLieuPlayer.exam.title}</h2>
                <p className={styles.heroDescription}>
                  {duLieuPlayer.exam.description ?? "Bài thi này chưa có mô tả chi tiết."}
                </p>
              </div>
              <div className={styles.statusGroup}>
                <span className={`${styles.pill} ${coAttempt ? styles.pillActive : styles.pillMuted}`}>
                  {duLieuPlayer.attempt ? "Đã tạo attempt" : "Chưa bắt đầu"}
                </span>
                <span className={`${styles.pill} ${duLieuPlayer.isLocked ? styles.pillLocked : styles.pillInfo}`}>
                  {duLieuPlayer.isLocked ? "Đã nộp bài" : "Đang làm bài"}
                </span>
              </div>
            </div>

            {thongBao ? (
              <p
                className={`${styles.inlineMessage} ${
                  thongBao.type === "success"
                    ? styles.inlineMessageSuccess
                    : thongBao.type === "error"
                      ? styles.inlineMessageError
                      : styles.inlineMessageInfo
                }`}
              >
                {thongBao.message}
              </p>
            ) : null}

            {!coAttempt ? (
              <div className={styles.heroActions}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  onClick={() => void xuLyBatDau()}
                  disabled={!duLieuPlayer.canStart || dangBatDau}
                  data-testid="exam-player-start"
                >
                  {dangBatDau ? "Đang khởi tạo attempt..." : "Bắt đầu làm bài"}
                </button>
              </div>
            ) : null}
          </section>

          {coAttempt ? (
            <div className={styles.layoutGrid}>
              <aside className={styles.sidebar}>
                <section className={styles.summaryCard}>
                  <h3 className={styles.sectionTitle}>Trạng thái attempt</h3>
                  <p className={styles.meta}>ID attempt: {attempt?.id}</p>
                  <p className={styles.meta}>Bắt đầu lúc: {dinhDangNgay(attempt?.startedAt ?? null)}</p>
                  <p className={styles.meta}>Nộp lúc: {dinhDangNgay(attempt?.submittedAt ?? null)}</p>
                  <p className={styles.meta}>
                    Tự chấm:{" "}
                    {attempt && attempt.autoGradedScore !== null && attempt.maxAutoGradedScore !== null
                      ? `${attempt.autoGradedScore}/${attempt.maxAutoGradedScore}`
                      : "Chưa có"}
                  </p>
                  <p className={styles.meta}>Câu cần chấm tay: {attempt?.pendingManualGradingCount ?? 0}</p>

                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonPrimary}`}
                      onClick={() => void xuLyNopBai()}
                      disabled={duLieuPlayer.isLocked || dangNop || !coQuestion}
                      data-testid="exam-player-submit"
                    >
                      {dangNop ? "Đang nộp bài..." : "Nộp bài"}
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => setTaiLaiKey((oldValue) => oldValue + 1)}
                      disabled={dangTai || dangNop}
                    >
                      Làm mới trạng thái
                    </button>
                  </div>
                </section>
              </aside>

              <section className={styles.questionColumn}>
                {!coQuestion ? (
                  <div className={styles.stateCard}>
                    Bài thi hiện chưa có câu hỏi để hiển thị. Hãy liên hệ giáo viên quản lý đề thi này.
                  </div>
                ) : null}

                {duLieuPlayer.questions.map((question, index) => {
                  const savedValue = savedAnswers[question.id] ?? "";
                  const draftValue = draftAnswers[question.id] ?? "";
                  const coBanNhapChuaLuu = coThayDoiChuaLuu(savedValue, draftValue);

                  return (
                    <article
                      key={question.id}
                      className={styles.questionCard}
                      data-testid="question-card"
                    >
                      <div className={styles.questionHeader}>
                        <div>
                          <p className={styles.questionIndex}>Câu {index + 1}</p>
                          <h3 className={styles.questionTitle}>{question.promptText}</h3>
                        </div>
                        <div className={styles.questionMeta}>
                          <span className={styles.pointsTag}>{question.points} điểm</span>
                          <span className={styles.typeTag}>{question.questionType}</span>
                        </div>
                      </div>

                      {renderQuestionInput(question)}

                      <div className={styles.questionFooter}>
                        <p className={styles.meta}>
                          {duLieuPlayer.isLocked
                            ? "Attempt đã nộp, câu trả lời bị khóa."
                            : coBanNhapChuaLuu
                              ? "Bạn có thay đổi chưa lưu."
                              : savedValue
                                ? "Câu trả lời đã được lưu trên máy chủ."
                                : "Chưa có câu trả lời nào được lưu."}
                        </p>
                        <button
                          type="button"
                          className={styles.button}
                          onClick={() => void xuLyLuuCauTraLoi(question.id)}
                          disabled={
                            duLieuPlayer.isLocked ||
                            dangNop ||
                            dangLuuTheoQuestion[question.id] === true ||
                            !coBanNhapChuaLuu
                          }
                        >
                          {dangLuuTheoQuestion[question.id] ? "Đang lưu..." : "Lưu câu trả lời"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
