# db

Thư mục này chứa migration và policy cho tầng dữ liệu Supabase/Postgres.

- `db/migrations/`: schema, function, trigger, hardening.
- `db/policies/`: RLS policy theo ownership và vai trò.

## Mốc hiện tại
- Đã có migration nền cho auth/role/profile/teacher verification.
- Đã có migration hardening `app_sessions` để lưu `token_hash` thay vì token thô.
- Đã có policy RLS nền bám ownership và admin review.

## Ghi chú kiến trúc
- Hướng A đang dùng custom auth runtime ở application layer.
- RLS là lớp phòng thủ phụ tại DB-layer, không phải lớp runtime authorization chính của user path trong giai đoạn hiện tại.
