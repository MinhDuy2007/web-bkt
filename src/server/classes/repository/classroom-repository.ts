import type {
  ClassMemberRecord,
  ClassMemberRole,
  ClassRecord,
  ClassStatus,
  MyClassItemRecord,
} from "@/types/classroom";

export type CreateClassInput = {
  classCode: string;
  educationLevel: string;
  subjectName: string;
  schoolName: string | null;
  gradeLabel: string;
  fullClassName: string;
  teacherUserId: string;
  joinCode: string;
  status: ClassStatus;
  createdAt: string;
};

export type CreateClassResult = {
  classRecord: ClassRecord;
  teacherMembership: ClassMemberRecord;
};

export type JoinClassByCodeInput = {
  classCode: string;
  joinCode: string;
  userId: string;
  memberRole: ClassMemberRole;
};

export interface ClassroomRepository {
  createClassByTeacher(input: CreateClassInput): Promise<CreateClassResult>;
  listMyClasses(userId: string): Promise<MyClassItemRecord[]>;
  joinClassByCode(input: JoinClassByCodeInput): Promise<MyClassItemRecord>;
}
