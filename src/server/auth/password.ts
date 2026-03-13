import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export function bamMatKhau(matKhau: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = scryptSync(matKhau, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function xacThucMatKhau(matKhau: string, daBam: string): boolean {
  const [salt, hashHex] = daBam.split(":");
  if (!salt || !hashHex) {
    return false;
  }

  const hashDaNhap = scryptSync(matKhau, salt, KEY_LENGTH);
  const hashMau = Buffer.from(hashHex, "hex");
  if (hashDaNhap.length !== hashMau.length) {
    return false;
  }

  return timingSafeEqual(hashDaNhap, hashMau);
}

