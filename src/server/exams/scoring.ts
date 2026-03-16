import { AuthError } from "@/server/auth/errors";
import type {
  ClassExamAnswerKeyRecord,
  ClassExamAttemptAnswerRecord,
  ClassExamQuestionRecord,
} from "@/types/exam";

type KetQuaChamTungCau = {
  awardedPoints: number;
  maxAutoPoints: number;
  laCauTuLuanChoChamTay: boolean;
  laCauChamTuDong: boolean;
};

function chuanHoaKhoangTrang(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function chuanHoaChuoiSoSanhCoBan(value: string): string {
  return chuanHoaKhoangTrang(value).toLowerCase();
}

function docTraLoiText(answer: ClassExamAttemptAnswerRecord | null): string | null {
  if (!answer) {
    return null;
  }

  if (typeof answer.answerText === "string") {
    const normalized = chuanHoaKhoangTrang(answer.answerText);
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

function chuanHoaBoolean(rawValue: string | null): "true" | "false" | null {
  if (!rawValue) {
    return null;
  }

  const lowered = rawValue.trim().toLowerCase();
  if (lowered === "true") {
    return "true";
  }

  if (lowered === "false") {
    return "false";
  }

  return null;
}

function lamTron2ChuSo(value: number): number {
  return Math.round(value * 100) / 100;
}

export function chamDiemNenChoCauHoi(
  question: ClassExamQuestionRecord,
  answerKey: ClassExamAnswerKeyRecord,
  answer: ClassExamAttemptAnswerRecord | null,
): KetQuaChamTungCau {
  if (question.questionType !== answerKey.keyType) {
    throw new AuthError({
      code: "POSTGRES_DATA_INVALID",
      message: "Question type khong khop answer key type trong luong cham diem nen.",
      statusCode: 500,
    });
  }

  if (question.questionType === "essay_placeholder") {
    return {
      awardedPoints: 0,
      maxAutoPoints: 0,
      laCauTuLuanChoChamTay: true,
      laCauChamTuDong: false,
    };
  }

  const rawAnswer = docTraLoiText(answer);
  if (!rawAnswer) {
    return {
      awardedPoints: 0,
      maxAutoPoints: question.points,
      laCauTuLuanChoChamTay: false,
      laCauChamTuDong: true,
    };
  }

  if (question.questionType === "multiple_choice_single") {
    const expected = answerKey.correctAnswerText ? chuanHoaChuoiSoSanhCoBan(answerKey.correctAnswerText) : "";
    const actual = chuanHoaChuoiSoSanhCoBan(rawAnswer);
    return {
      awardedPoints: actual === expected ? question.points : 0,
      maxAutoPoints: question.points,
      laCauTuLuanChoChamTay: false,
      laCauChamTuDong: true,
    };
  }

  if (question.questionType === "true_false") {
    const expected = chuanHoaBoolean(answerKey.correctAnswerText);
    const actual = chuanHoaBoolean(rawAnswer);
    return {
      awardedPoints: expected && actual && expected === actual ? question.points : 0,
      maxAutoPoints: question.points,
      laCauTuLuanChoChamTay: false,
      laCauChamTuDong: true,
    };
  }

  const caseSensitive = question.metadataJson.caseSensitive === true;
  const expectedShortAnswer = answerKey.correctAnswerText
    ? (caseSensitive
      ? chuanHoaKhoangTrang(answerKey.correctAnswerText)
      : chuanHoaChuoiSoSanhCoBan(answerKey.correctAnswerText))
    : "";
  const actualShortAnswer = caseSensitive
    ? chuanHoaKhoangTrang(rawAnswer)
    : chuanHoaChuoiSoSanhCoBan(rawAnswer);
  return {
    awardedPoints: actualShortAnswer === expectedShortAnswer ? question.points : 0,
    maxAutoPoints: question.points,
    laCauTuLuanChoChamTay: false,
    laCauChamTuDong: true,
  };
}

export function lamTronDiemNen(value: number): number {
  return lamTron2ChuSo(value);
}
