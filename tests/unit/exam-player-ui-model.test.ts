import assert from "node:assert/strict";
import test from "node:test";
import {
  coThayDoiChuaLuu,
  docDanhSachLuaChon,
  taoBanDoTraLoiBanDau,
  xacDinhLoaiInputLamBai,
} from "@/app/bai-thi/[examCode]/exam-player-model";
import type { ClassExamAttemptAnswerRecord, ClassExamQuestionRecord } from "@/types/exam";

function taoQuestion(
  id: string,
  questionType: ClassExamQuestionRecord["questionType"],
  metadataJson: Record<string, unknown> = {},
): ClassExamQuestionRecord {
  return {
    id,
    classExamId: "exam-1",
    questionOrder: 1,
    questionType,
    promptText: "Prompt",
    points: 1,
    metadataJson,
    createdByUserId: "teacher-1",
    createdAt: "2026-03-16T00:00:00.000Z",
    updatedAt: "2026-03-16T00:00:00.000Z",
  };
}

function taoAnswer(questionId: string, answerText: string): ClassExamAttemptAnswerRecord {
  return {
    id: `answer-${questionId}`,
    attemptId: "attempt-1",
    questionId,
    answerText,
    answerJson: {},
    awardedPoints: null,
    manualAwardedPoints: null,
    gradingNote: null,
    gradedBy: null,
    gradedAt: null,
    scoredAt: null,
    createdAt: "2026-03-16T00:00:00.000Z",
    updatedAt: "2026-03-16T00:00:00.000Z",
  };
}

test("mapping question type -> input kind dung", () => {
  assert.equal(xacDinhLoaiInputLamBai("multiple_choice_single"), "multiple_choice_single");
  assert.equal(xacDinhLoaiInputLamBai("true_false"), "true_false");
  assert.equal(xacDinhLoaiInputLamBai("short_answer"), "short_answer");
  assert.equal(xacDinhLoaiInputLamBai("essay_placeholder"), "essay_placeholder");
});

test("tao ban do tra loi ban dau theo question va answer", () => {
  const questions = [
    taoQuestion("q1", "short_answer"),
    taoQuestion("q2", "essay_placeholder"),
  ];
  const answers = [taoAnswer("q1", "Ha Noi")];

  const map = taoBanDoTraLoiBanDau(questions, answers);

  assert.equal(map.q1, "Ha Noi");
  assert.equal(map.q2, "");
});

test("coThayDoiChuaLuu so sanh theo gia tri trim", () => {
  assert.equal(coThayDoiChuaLuu("Ha Noi", "Ha Noi"), false);
  assert.equal(coThayDoiChuaLuu("Ha Noi", "  Ha Noi  "), false);
  assert.equal(coThayDoiChuaLuu("Ha Noi", "Hai Phong"), true);
});

test("docDanhSachLuaChon lay dung options hop le", () => {
  const question = taoQuestion("q3", "multiple_choice_single", {
    options: ["A", "B", 1, null],
  });

  assert.deepEqual(docDanhSachLuaChon(question), ["A", "B"]);
});
