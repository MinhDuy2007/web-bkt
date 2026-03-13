import type { AuthRepository } from "@/server/auth/repository/auth-repository";
import { AuthError } from "@/server/auth/errors";
import { taoSupabaseServerClient } from "@/server/supabase/server-client";

function taoLoiChuaTrienKhai(action: string): never {
  throw new AuthError({
    code: "SUPABASE_ADAPTER_NOT_IMPLEMENTED",
    message: `[supabase-auth] Chua trien khai thao tac ${action}.`,
    statusCode: 501,
  });
}

export function taoSupabaseAuthRepository(): AuthRepository {
  taoSupabaseServerClient();

  return {
    async createUser() {
      taoLoiChuaTrienKhai("createUser");
    },
    async findUserByEmail() {
      taoLoiChuaTrienKhai("findUserByEmail");
    },
    async findUserById() {
      taoLoiChuaTrienKhai("findUserById");
    },
    async updateUser() {
      taoLoiChuaTrienKhai("updateUser");
    },
    async upsertProfile() {
      taoLoiChuaTrienKhai("upsertProfile");
    },
    async findProfileByUserId() {
      taoLoiChuaTrienKhai("findProfileByUserId");
    },
    async createSession() {
      taoLoiChuaTrienKhai("createSession");
    },
    async findSessionByToken() {
      taoLoiChuaTrienKhai("findSessionByToken");
    },
    async deleteSession() {
      taoLoiChuaTrienKhai("deleteSession");
    },
    async upsertTeacherVerificationRequest() {
      taoLoiChuaTrienKhai("upsertTeacherVerificationRequest");
    },
    async findTeacherVerificationByUserId() {
      taoLoiChuaTrienKhai("findTeacherVerificationByUserId");
    },
  };
}

