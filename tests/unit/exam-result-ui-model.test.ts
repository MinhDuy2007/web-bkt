import assert from "node:assert/strict";
import test from "node:test";
import {
  docNhanChamTungCau,
  docNhanDiemTuDong,
  docTraLoiDeReview,
  xacDinhCheDoKetQua,
} from "@/app/ket-qua/[examCode]/result-model";
import type {
  ClassExamAttemptRecord,
  ClassExamQuestionRecord,
  StudentExamReviewItemRecord,
} from "@/types/exam";

function taoAttempt(status: ClassExamAttemptRecord["status"]): ClassExamAttemptRecord {
  return {
    id: "attempt-1",
    classExamId: "exam-1",
    userId: "user-1",
    status,
    startedAt: "2026-03-16T00:00:00.000Z",
    submittedAt: status === "submitted" ? "2026-03-16T00:10:00.000Z" : null,
    autoGradedScore: status === "submitted" ? 2 : null,
    maxAutoGradedScore: status === "submitted" ? 3 : null,
    pendingManualGradingCount: 1,
    createdAt: "2026-03-16T00:00:00.000Z",
    updatedAt: "2026-03-16T00:10:00.000Z",
  };
}

function taoQuestion(questionType: ClassExamQuestionRecord["questionType"]): ClassExamQuestionRecord {
  return {
    id: `question-${questionType}`,
    classExamId: "exam-1",
    questionOrder: 1,
    questionType,
    promptText: "Prompt",
    points: 3,
    metadataJson: {},
    createdByUserId: "teacher-1",
    createdAt: "2026-03-16T00:00:00.000Z",
    updatedAt: "2026-03-16T00:00:00.000Z",
  };
}

function taoReviewItem(
  questionType: ClassExamQuestionRecord["questionType"],
  answerText: string | null,
  awardedPoints: number | null,
): StudentExamReviewItemRecord {
  return {
    question: taoQuestion(questionType),
    answer: answerText === null
      ? null
      : {
          id: "answer-1",
          attemptId: "attempt-1",
          questionId: `question-${questionType}`,
          answerText,
          answerJson: {},
          awardedPoints,
          scoredAt: awardedPoints === null ? null : "2026-03-16T00:12:00.000Z",
          createdAt: "2026-03-16T00:05:00.000Z",
          updatedAt: "2026-03-16T00:12:00.000Z",
        },
  };
}

test("xac dinh che do ket qua dung theo attempt", () => {
  assert.equal(xacDinhCheDoKetQua(null), "not_started");
  assert.equal(xacDinhCheDoKetQua(taoAttempt("started")), "in_progress");
  assert.equal(xacDinhCheDoKetQua(taoAttempt("submitted")), "submitted");
});

test("doc nhan diem tu dong dung du lieu server", () => {
  assert.equal(
    docNhanDiemTuDong({
      totalQuestionCount: 4,
      answeredQuestionCount: 3,
      submitted: true,
      submittedAt: "2026-03-16T00:10:00.000Z",
      autoGradedScore: 5,
      maxAutoGradableScore: 6,
      pendingManualGradingCount: 1,
    }),
    "5/6",
  );
  assert.equal(
    docNhanDiemTuDong({
      totalQuestionCount: 4,
      answeredQuestionCount: 1,
      submitted: false,
      submittedAt: null,
      autoGradedScore: null,
      maxAutoGradableScore: null,
      pendingManualGradingCount: 0,
    }),
    "Chưa có",
  );
});

test("doc tra loi review va nhan cham tung cau dung theo trang thai", () => {
  const mcqItem = taoReviewItem("multiple_choice_single", "4", 3);
  const essayItem = taoReviewItem("essay_placeholder", "Bai lam essay", 0);
  const emptyItem = taoReviewItem("short_answer", null, null);

  assert.equal(docTraLoiDeReview(mcqItem), "4");
  assert.equal(docTraLoiDeReview(emptyItem), "Chưa có câu trả lời đã lưu.");
  assert.equal(docNhanChamTungCau(mcqItem, false), "Attempt chưa nộp, chưa có kết quả hoàn chỉnh.");
  assert.equal(docNhanChamTungCau(mcqItem, true), "Đã chấm tự động: 3/3 điểm.");
  assert.equal(docNhanChamTungCau(essayItem, true), "Đang chờ chấm tay.");
  assert.equal(docNhanChamTungCau(emptyItem, true), "Không có câu trả lời đã lưu.");
});
