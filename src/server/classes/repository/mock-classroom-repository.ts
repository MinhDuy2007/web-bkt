import { randomUUID } from "node:crypto";
import { AuthError } from "@/server/auth/errors";
import type {
  ClassroomRepository,
  CreateClassInput,
  CreateClassResult,
  JoinClassByCodeInput,
} from "@/server/classes/repository/classroom-repository";
import type { ClassMemberRecord, ClassRecord, MyClassItemRecord } from "@/types/classroom";

type MockClassroomStore = {
  classesById: Map<string, ClassRecord>;
  classIdByClassCode: Map<string, string>;
  membersByClassId: Map<string, ClassMemberRecord[]>;
};

const mockClassroomStore: MockClassroomStore = {
  classesById: new Map<string, ClassRecord>(),
  classIdByClassCode: new Map<string, string>(),
  membersByClassId: new Map<string, ClassMemberRecord[]>(),
};

function saoChep<T>(value: T): T {
  return structuredClone(value);
}

function layClassCodeKey(classCode: string): string {
  return classCode.trim().toUpperCase();
}

export function layLopHocGiaLapTheoMaLop(classCode: string): ClassRecord | null {
  const classId = mockClassroomStore.classIdByClassCode.get(layClassCodeKey(classCode));
  if (!classId) {
    return null;
  }

  const classRecord = mockClassroomStore.classesById.get(classId);
  return classRecord ? saoChep(classRecord) : null;
}

export function laThanhVienLopHocGiaLap(classId: string, userId: string): boolean {
  const members = mockClassroomStore.membersByClassId.get(classId) ?? [];
  return members.some((item) => item.userId === userId);
}

export function datLaiKhoLopHocGiaLap(): void {
  mockClassroomStore.classesById.clear();
  mockClassroomStore.classIdByClassCode.clear();
  mockClassroomStore.membersByClassId.clear();
}

function taoMockClassroomRepository(): ClassroomRepository {
  return {
    async createClassByTeacher(input: CreateClassInput): Promise<CreateClassResult> {
      const classCodeKey = layClassCodeKey(input.classCode);
      if (mockClassroomStore.classIdByClassCode.has(classCodeKey)) {
        throw new AuthError({
          code: "CLASS_CODE_ALREADY_EXISTS",
          message: "Ma lop da ton tai.",
          statusCode: 409,
        });
      }

      const classRecord: ClassRecord = {
        id: randomUUID(),
        classCode: classCodeKey,
        educationLevel: input.educationLevel,
        subjectName: input.subjectName,
        schoolName: input.schoolName,
        gradeLabel: input.gradeLabel,
        fullClassName: input.fullClassName,
        teacherUserId: input.teacherUserId,
        joinCode: input.joinCode.trim().toUpperCase(),
        status: input.status,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };

      const teacherMembership: ClassMemberRecord = {
        id: randomUUID(),
        classId: classRecord.id,
        userId: input.teacherUserId,
        memberRole: "teacher",
        joinedAt: input.createdAt,
        createdAt: input.createdAt,
      };

      mockClassroomStore.classesById.set(classRecord.id, classRecord);
      mockClassroomStore.classIdByClassCode.set(classCodeKey, classRecord.id);
      mockClassroomStore.membersByClassId.set(classRecord.id, [teacherMembership]);

      return {
        classRecord: saoChep(classRecord),
        teacherMembership: saoChep(teacherMembership),
      };
    },

    async listMyClasses(userId: string): Promise<MyClassItemRecord[]> {
      const items: MyClassItemRecord[] = [];

      for (const [classId, members] of mockClassroomStore.membersByClassId.entries()) {
        const classRecord = mockClassroomStore.classesById.get(classId);
        if (!classRecord) {
          continue;
        }

        const membership = members.find((item) => item.userId === userId);
        if (!membership) {
          continue;
        }

        items.push({
          classRecord: saoChep(classRecord),
          membership: saoChep(membership),
        });
      }

      return items.sort(
        (a, b) =>
          new Date(b.membership.joinedAt).getTime() -
          new Date(a.membership.joinedAt).getTime(),
      );
    },

    async joinClassByCode(input: JoinClassByCodeInput): Promise<MyClassItemRecord> {
      const classCodeKey = layClassCodeKey(input.classCode);
      const classId = mockClassroomStore.classIdByClassCode.get(classCodeKey);
      if (!classId) {
        throw new AuthError({
          code: "CLASS_NOT_FOUND",
          message: "Khong tim thay lop hoc theo ma da nhap.",
          statusCode: 404,
        });
      }

      const classRecord = mockClassroomStore.classesById.get(classId);
      if (!classRecord || classRecord.status !== "active") {
        throw new AuthError({
          code: "CLASS_NOT_AVAILABLE",
          message: "Lop hoc hien khong con mo de tham gia.",
          statusCode: 409,
        });
      }

      if (classRecord.joinCode !== input.joinCode.trim().toUpperCase()) {
        throw new AuthError({
          code: "CLASS_JOIN_CODE_INVALID",
          message: "Ma tham gia lop hoc khong dung.",
          statusCode: 400,
        });
      }

      const members = mockClassroomStore.membersByClassId.get(classId) ?? [];
      if (members.some((item) => item.userId === input.userId)) {
        throw new AuthError({
          code: "CLASS_MEMBER_ALREADY_EXISTS",
          message: "Tai khoan da la thanh vien cua lop hoc nay.",
          statusCode: 409,
        });
      }

      const nowIso = new Date().toISOString();
      const membership: ClassMemberRecord = {
        id: randomUUID(),
        classId,
        userId: input.userId,
        memberRole: input.memberRole,
        joinedAt: nowIso,
        createdAt: nowIso,
      };
      members.push(membership);
      mockClassroomStore.membersByClassId.set(classId, members);

      return {
        classRecord: saoChep(classRecord),
        membership: saoChep(membership),
      };
    },
  };
}

let cachedMockClassroomRepository: ClassroomRepository | null = null;

export function layMockClassroomRepository(): ClassroomRepository {
  if (!cachedMockClassroomRepository) {
    cachedMockClassroomRepository = taoMockClassroomRepository();
  }

  return cachedMockClassroomRepository;
}
