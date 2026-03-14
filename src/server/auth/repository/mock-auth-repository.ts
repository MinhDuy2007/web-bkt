import { randomUUID } from "node:crypto";
import { AuthError } from "@/server/auth/errors";
import type {
  AccountRecord,
  TeacherVerificationRequestStatus,
  SessionRecord,
  TeacherVerificationRequestRecord,
  UserProfileRecord,
} from "@/types/auth";
import type {
  AuthRepository,
  CreateSessionInput,
  CreateUserInput,
  ReviewTeacherVerificationInput,
  ReviewTeacherVerificationResult,
  UpdateUserInput,
  UpsertProfileInput,
} from "@/server/auth/repository/auth-repository";

type MockStore = {
  usersById: Map<string, AccountRecord>;
  userIdsByEmail: Map<string, string>;
  profilesByUserId: Map<string, UserProfileRecord>;
  sessionsByTokenHash: Map<string, SessionRecord>;
  teacherRequestsByUserId: Map<string, TeacherVerificationRequestRecord>;
  teacherAuditLogs: MockTeacherVerificationAuditLog[];
};

export type MockTeacherVerificationAuditLog = {
  id: string;
  requestId: string;
  userId: string;
  actorUserId: string | null;
  action: "submitted" | "approved" | "rejected" | "updated";
  oldStatus: TeacherVerificationRequestStatus | null;
  newStatus: TeacherVerificationRequestStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const mockStore: MockStore = {
  usersById: new Map<string, AccountRecord>(),
  userIdsByEmail: new Map<string, string>(),
  profilesByUserId: new Map<string, UserProfileRecord>(),
  sessionsByTokenHash: new Map<string, SessionRecord>(),
  teacherRequestsByUserId: new Map<string, TeacherVerificationRequestRecord>(),
  teacherAuditLogs: [],
};

function saoChep<T>(value: T): T {
  return structuredClone(value);
}

function layEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

export function datLaiKhoAuthGiaLap(): void {
  mockStore.usersById.clear();
  mockStore.userIdsByEmail.clear();
  mockStore.profilesByUserId.clear();
  mockStore.sessionsByTokenHash.clear();
  mockStore.teacherRequestsByUserId.clear();
  mockStore.teacherAuditLogs = [];
}

export function layNhatKyXacMinhGiaoVienGiaLap(
  requestId?: string,
): MockTeacherVerificationAuditLog[] {
  if (!requestId) {
    return saoChep(mockStore.teacherAuditLogs);
  }

  return saoChep(mockStore.teacherAuditLogs.filter((item) => item.requestId === requestId));
}

function ghiNhatKyXacMinhGiaoVien(
  request: TeacherVerificationRequestRecord,
  actorUserId: string | null,
  oldStatus: TeacherVerificationRequestStatus | null,
  newStatus: TeacherVerificationRequestStatus,
  metadata: Record<string, unknown>,
): void {
  const action: MockTeacherVerificationAuditLog["action"] =
    oldStatus === null
      ? "submitted"
      : newStatus === "approved"
        ? "approved"
        : newStatus === "rejected"
          ? "rejected"
          : "updated";

  mockStore.teacherAuditLogs.push({
    id: `${mockStore.teacherAuditLogs.length + 1}`,
    requestId: request.id,
    userId: request.userId,
    actorUserId,
    action,
    oldStatus,
    newStatus,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

function taoMockAuthRepository(): AuthRepository {
  return {
    async createUser(input: CreateUserInput): Promise<AccountRecord> {
      const emailKey = layEmailKey(input.email);
      if (mockStore.userIdsByEmail.has(emailKey)) {
        throw new Error("Email da ton tai trong kho auth gia lap.");
      }

      const nowIso = new Date().toISOString();
      const created: AccountRecord = {
        id: randomUUID(),
        email: emailKey,
        passwordHash: input.passwordHash,
        roles: [...input.roles],
        accountStatus: input.accountStatus,
        identityStatus: input.identityStatus,
        teacherVerificationStatus: input.teacherVerificationStatus,
        createdAt: input.createdAt,
        updatedAt: nowIso,
        createdByUserId: null,
      };

      mockStore.usersById.set(created.id, created);
      mockStore.userIdsByEmail.set(emailKey, created.id);

      return saoChep(created);
    },

    async findUserByEmail(email: string): Promise<AccountRecord | null> {
      const userId = mockStore.userIdsByEmail.get(layEmailKey(email));
      if (!userId) {
        return null;
      }

      const found = mockStore.usersById.get(userId);
      return found ? saoChep(found) : null;
    },

    async findUserById(userId: string): Promise<AccountRecord | null> {
      const found = mockStore.usersById.get(userId);
      return found ? saoChep(found) : null;
    },

    async updateUser(userId: string, input: UpdateUserInput): Promise<AccountRecord> {
      const current = mockStore.usersById.get(userId);
      if (!current) {
        throw new Error("Khong tim thay user de cap nhat.");
      }

      const updated: AccountRecord = {
        ...current,
        ...input,
        roles: input.roles ? [...input.roles] : [...current.roles],
        updatedAt: new Date().toISOString(),
      };

      mockStore.usersById.set(userId, updated);
      return saoChep(updated);
    },

    async upsertProfile(input: UpsertProfileInput): Promise<UserProfileRecord> {
      const current = mockStore.profilesByUserId.get(input.userId);
      const upserted: UserProfileRecord = {
        userId: input.userId,
        displayName: input.displayName,
        fullName: input.fullName,
        birthYear: input.birthYear ?? null,
        schoolName: input.schoolName ?? null,
        createdAt: current?.createdAt ?? input.createdAt,
        updatedAt: input.updatedAt,
      };

      mockStore.profilesByUserId.set(input.userId, upserted);
      return saoChep(upserted);
    },

    async findProfileByUserId(userId: string): Promise<UserProfileRecord | null> {
      const found = mockStore.profilesByUserId.get(userId);
      return found ? saoChep(found) : null;
    },

    async createSession(input: CreateSessionInput): Promise<SessionRecord> {
      const session: SessionRecord = {
        tokenHash: input.tokenHash,
        userId: input.userId,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
      };

      mockStore.sessionsByTokenHash.set(session.tokenHash, session);
      return saoChep(session);
    },

    async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
      const found = mockStore.sessionsByTokenHash.get(tokenHash);
      return found ? saoChep(found) : null;
    },

    async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
      mockStore.sessionsByTokenHash.delete(tokenHash);
    },

    async upsertTeacherVerificationRequest(
      input: TeacherVerificationRequestRecord,
    ): Promise<TeacherVerificationRequestRecord> {
      const current = mockStore.teacherRequestsByUserId.get(input.userId);
      const normalized: TeacherVerificationRequestRecord = {
        ...input,
        teachingSubjects: [...input.teachingSubjects],
        evidenceUrls: [...input.evidenceUrls],
      };
      mockStore.teacherRequestsByUserId.set(input.userId, normalized);
      ghiNhatKyXacMinhGiaoVien(
        normalized,
        current?.reviewedByUserId ?? normalized.userId,
        current?.status ?? null,
        normalized.status,
        {
          source: "mock_upsert",
        },
      );
      return saoChep(normalized);
    },

    async findTeacherVerificationByUserId(
      userId: string,
    ): Promise<TeacherVerificationRequestRecord | null> {
      const found = mockStore.teacherRequestsByUserId.get(userId);
      return found ? saoChep(found) : null;
    },

    async reviewTeacherVerification(
      input: ReviewTeacherVerificationInput,
    ): Promise<ReviewTeacherVerificationResult> {
      const actor = mockStore.usersById.get(input.actorUserId);
      if (!actor) {
        throw new AuthError({
          code: "ADMIN_ACTOR_NOT_FOUND",
          message: "Khong tim thay tai khoan admin thuc hien review.",
          statusCode: 404,
        });
      }

      if (actor.accountStatus !== "active" || !actor.roles.includes("admin")) {
        throw new AuthError({
          code: "ADMIN_PERMISSION_REQUIRED",
          message: "Tai khoan hien tai khong co quyen review xac minh giao vien.",
          statusCode: 403,
        });
      }

      const request = Array.from(mockStore.teacherRequestsByUserId.values()).find(
        (item) => item.id === input.requestId,
      );
      if (!request) {
        throw new AuthError({
          code: "REQUEST_NOT_FOUND",
          message: "Khong tim thay yeu cau xac minh giao vien.",
          statusCode: 404,
        });
      }

      if (request.status !== "pending_review") {
        throw new AuthError({
          code: "REQUEST_ALREADY_REVIEWED",
          message: "Yeu cau da duoc review truoc do, khong the review lai.",
          statusCode: 409,
        });
      }

      const account = mockStore.usersById.get(request.userId);
      if (!account) {
        throw new AuthError({
          code: "TARGET_ACCOUNT_NOT_FOUND",
          message: "Khong tim thay tai khoan can cap nhat trang thai giao vien.",
          statusCode: 404,
        });
      }

      const reviewedAt = new Date().toISOString();
      const nextStatus: TeacherVerificationRequestStatus =
        input.action === "approve" ? "approved" : "rejected";
      const nextRoles: AccountRecord["roles"] =
        input.action === "approve"
          ? Array.from(new Set<AccountRecord["roles"][number]>([...account.roles, "teacher"]))
          : (() => {
              const filtered = account.roles.filter((role) => role !== "teacher");
              return filtered.length > 0 ? filtered : (["user"] as AccountRecord["roles"]);
            })();

      const nextRequest: TeacherVerificationRequestRecord = {
        ...request,
        status: nextStatus,
        reviewedByUserId: actor.id,
        reviewedAt,
        adminNote: input.adminNote ?? null,
        updatedAt: reviewedAt,
      };
      const nextAccount: AccountRecord = {
        ...account,
        roles: nextRoles,
        teacherVerificationStatus: nextStatus,
        updatedAt: reviewedAt,
      };

      mockStore.teacherRequestsByUserId.set(nextRequest.userId, nextRequest);
      mockStore.usersById.set(nextAccount.id, nextAccount);
      ghiNhatKyXacMinhGiaoVien(
        nextRequest,
        actor.id,
        request.status,
        nextRequest.status,
        {
          source: "mock_review",
          action: input.action,
          auditMetadata: input.auditMetadata ?? null,
        },
      );

      return {
        request: saoChep(nextRequest),
        account: saoChep(nextAccount),
      };
    },
  };
}

let cachedMockRepository: AuthRepository | null = null;

export function layMockAuthRepository(): AuthRepository {
  if (!cachedMockRepository) {
    cachedMockRepository = taoMockAuthRepository();
  }

  return cachedMockRepository;
}
