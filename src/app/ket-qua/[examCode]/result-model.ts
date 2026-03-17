import type { StudentExamResultRecord, StudentExamReviewItemRecord } from "@/types/exam";

export type CheDoKetQua = "not_started" | "in_progress" | "submitted";

export function xacDinhCheDoKetQua(
  attempt: StudentExamResultRecord["attempt"],
): CheDoKetQua {
  if (!attempt) {
    return "not_started";
  }

  return attempt.status === "submitted" ? "submitted" : "in_progress";
}

export function docNhanDiemTuDong(
  summary: StudentExamResultRecord["summary"],
): string {
  if (summary.autoGradedScore === null || summary.maxAutoGradableScore === null) {
    return "Chưa có";
  }

  return `${summary.autoGradedScore}/${summary.maxAutoGradableScore}`;
}

export function docNhanDiemCuoi(
  summary: StudentExamResultRecord["summary"],
): string {
  if (summary.finalScore === null) {
    return "Đang chờ hoàn tất chấm tay";
  }

  return `${summary.finalScore}`;
}

export function docNhanChamTungCau(
  item: StudentExamReviewItemRecord,
  daNopBai: boolean,
): string {
  if (!daNopBai) {
    return "Attempt chưa nộp, chưa có kết quả hoàn chỉnh.";
  }

  if (item.question.questionType === "essay_placeholder") {
    if (!item.answer) {
      return "Không có câu trả lời đã lưu.";
    }

    if (item.answer.manualAwardedPoints !== null) {
      return `Đã chấm tay: ${item.answer.manualAwardedPoints}/${item.question.points} điểm.`;
    }

    return "Đang chờ giáo viên hoặc AI-assisted grading hỗ trợ chấm.";
  }

  if (!item.answer) {
    return "Không có câu trả lời đã lưu.";
  }

  if (item.answer.awardedPoints === null) {
    return "Máy chủ chưa trả dữ liệu chấm tự động cho câu này.";
  }

  return `Đã chấm tự động: ${item.answer.awardedPoints}/${item.question.points} điểm.`;
}

export function docTraLoiDeReview(item: StudentExamReviewItemRecord): string {
  const answerText = item.answer?.answerText?.trim() ?? "";
  return answerText.length > 0 ? answerText : "Chưa có câu trả lời đã lưu.";
}

export function docGhiChuChamTay(item: StudentExamReviewItemRecord): string | null {
  if (item.question.questionType !== "essay_placeholder") {
    return null;
  }

  const note = item.answer?.gradingNote?.trim() ?? "";
  return note.length > 0 ? note : null;
}
