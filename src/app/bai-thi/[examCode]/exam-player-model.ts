import type {
  ClassExamAttemptAnswerRecord,
  ClassExamQuestionRecord,
  ClassExamQuestionType,
} from "@/types/exam";

export type LoaiInputLamBai = "multiple_choice_single" | "true_false" | "short_answer" | "essay_placeholder";

export function xacDinhLoaiInputLamBai(questionType: ClassExamQuestionType): LoaiInputLamBai {
  return questionType;
}

export function docGiaTriTraLoiHienTai(answer: ClassExamAttemptAnswerRecord | null): string {
  return answer?.answerText ?? "";
}

export function taoBanDoTraLoiBanDau(
  questions: ClassExamQuestionRecord[],
  answers: ClassExamAttemptAnswerRecord[],
): Record<string, string> {
  const answerByQuestionId = new Map(answers.map((item) => [item.questionId, item]));
  return questions.reduce<Record<string, string>>((accumulator, question) => {
    accumulator[question.id] = docGiaTriTraLoiHienTai(answerByQuestionId.get(question.id) ?? null);
    return accumulator;
  }, {});
}

export function coThayDoiChuaLuu(savedValue: string, draftValue: string): boolean {
  return savedValue.trim() !== draftValue.trim();
}

export function docDanhSachLuaChon(question: ClassExamQuestionRecord): string[] {
  const rawOptions = question.metadataJson.options;
  if (!Array.isArray(rawOptions)) {
    return [];
  }

  return rawOptions.filter((item): item is string => typeof item === "string");
}
