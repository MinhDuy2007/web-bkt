import { randomUUID } from "node:crypto";
import type {
  AccountRecord,
  SessionRecord,
  TeacherVerificationRequestRecord,
  UserProfileRecord,
} from "@/types/auth";
import type {
  AuthRepository,
  CreateSessionInput,
  CreateUserInput,
  UpdateUserInput,
  UpsertProfileInput,
} from "@/server/auth/repository/auth-repository";

type MockStore = {
  usersById: Map<string, AccountRecord>;
  userIdsByEmail: Map<string, string>;
  profilesByUserId: Map<string, UserProfileRecord>;
  sessionsByTokenHash: Map<string, SessionRecord>;
  teacherRequestsByUserId: Map<string, TeacherVerificationRequestRecord>;
};

const mockStore: MockStore = {
  usersById: new Map<string, AccountRecord>(),
  userIdsByEmail: new Map<string, string>(),
  profilesByUserId: new Map<string, UserProfileRecord>(),
  sessionsByTokenHash: new Map<string, SessionRecord>(),
  teacherRequestsByUserId: new Map<string, TeacherVerificationRequestRecord>(),
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
      const normalized: TeacherVerificationRequestRecord = {
        ...input,
        teachingSubjects: [...input.teachingSubjects],
        evidenceUrls: [...input.evidenceUrls],
      };
      mockStore.teacherRequestsByUserId.set(input.userId, normalized);
      return saoChep(normalized);
    },

    async findTeacherVerificationByUserId(
      userId: string,
    ): Promise<TeacherVerificationRequestRecord | null> {
      const found = mockStore.teacherRequestsByUserId.get(userId);
      return found ? saoChep(found) : null;
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
