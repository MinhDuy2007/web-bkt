export const CLASS_STATUSES = ["active", "archived"] as const;
export type ClassStatus = (typeof CLASS_STATUSES)[number];

export const CLASS_MEMBER_ROLES = ["teacher", "student"] as const;
export type ClassMemberRole = (typeof CLASS_MEMBER_ROLES)[number];

export type ClassRecord = {
  id: string;
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
  updatedAt: string;
};

export type ClassMemberRecord = {
  id: string;
  classId: string;
  userId: string;
  memberRole: ClassMemberRole;
  joinedAt: string;
  createdAt: string;
};

export type MyClassItemRecord = {
  classRecord: ClassRecord;
  membership: ClassMemberRecord;
};
