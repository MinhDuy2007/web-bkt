# db

Thư mục này chứa SQL nguồn gốc của dự án cho schema và policy:

- `db/migrations/`: schema, function, trigger, hardening.
- `db/policies/`: RLS policy theo ownership và vai trò.

## Quy ước nguồn migration

- Nguồn gốc duy nhất của SQL dự án là `db/migrations` và `db/policies`.
- Supabase CLI không đọc trực tiếp hai thư mục trên khi `db push`.
- Trước khi push, phải đồng bộ sang `supabase/migrations` bằng script:
  - `node scripts/prepare-supabase-migrations.mjs`

## Quy trình chuẩn khi push DB

1. `npm run db:push:dry`
2. Nếu dry-run sạch, chạy `npm run db:push`
3. Sau push, xác minh bảng thật trên remote DB bằng script runtime audit.

Các script `db:push:dry`, `db:push`, `db:push:staging` đã bao gồm bước chuẩn bị migration.

## Ghi chú kiến trúc

- Hướng A đang dùng custom auth runtime ở application layer.
- RLS là lớp phòng thủ bổ sung tại DB-layer, không phải lớp runtime authorization chính cho user path ở giai đoạn hiện tại.
- Admin review teacher verification dùng hàm DB transaction:
  - `public.app_admin_review_teacher_verification(...)`
  - Mục tiêu: cập nhật đồng bộ `teacher_verification_requests` và `user_accounts` trong cùng một thao tác.

## Least-privilege cho user-facing DB path

- User-facing repository hiện truy cập qua `DATABASE_URL`.
- Có thể bật kiểm tra runtime bằng `DATABASE_EXPECTED_USER` để chặn nhầm credential.
- Nếu chuỗi kết nối vẫn dùng role quyền rộng, rủi ro vẫn tồn tại khi app-layer bị lỗi logic hoặc lộ credential.
- Mẫu tách role/grant tối thiểu nằm tại:
  - `db/least-privilege-user-path.sql`
- Đây là mẫu chuẩn bị vận hành, cần DBA/Supabase owner áp dụng theo môi trường thật.
