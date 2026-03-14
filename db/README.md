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

## Least-privilege cho user-facing DB path
- User-facing repository hiện truy cập qua `DATABASE_URL`.
- Có thể bật kiểm tra runtime bằng `DATABASE_EXPECTED_USER` để chặn nhầm credential.
- Nếu chuỗi kết nối này dùng role quyền rộng, rủi ro vẫn tồn tại khi app-layer bị lỗi logic hoặc lộ credential.
- Đã bổ sung mẫu tách role/grant tối thiểu tại:
  - `db/least-privilege-user-path.sql`
- Đây là mẫu chuẩn bị vận hành, cần DBA/Supabase owner áp dụng theo môi trường thật.
