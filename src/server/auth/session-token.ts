import { createHash, randomBytes } from "node:crypto";
import { layBienMoiTruongServer } from "@/server/config/env";

const SESSION_TOKEN_BYTE_LENGTH = 32;

export function taoSessionTokenGoc(): string {
  return randomBytes(SESSION_TOKEN_BYTE_LENGTH).toString("hex");
}

export function bamSessionToken(token: string): string {
  const normalizedToken = token.trim();
  if (!normalizedToken) {
    throw new Error("[session-token] Token khong hop le de bam.");
  }

  const env = layBienMoiTruongServer();
  return createHash("sha256")
    .update(env.sessionTokenPepper)
    .update(":")
    .update(normalizedToken)
    .digest("hex");
}
