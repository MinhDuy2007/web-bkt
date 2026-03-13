# Auth Nền Tảng Task 2

## Mục tiêu
- Khóa ranh giới client-server cho xác thực và phân quyền.
- Tách rõ các lớp trạng thái tài khoản, xác minh người dùng cơ bản, và xác minh giáo viên.
- Chuẩn bị kiến trúc để gắn Supabase thật ở task dữ liệu kế tiếp.

## Vai trò
- `admin`: có quyền quản trị, duyệt xác minh giáo viên.
- `teacher`: vai trò giáo viên, chỉ có hiệu lực quyền giáo viên khi `teacherVerificationStatus=approved`.
- `student`: vai trò học sinh.
- `user`: vai trò người dùng phổ thông.

## Trạng thái
- `accountStatus`: `active | suspended | pending`
- `identityStatus`: `unverified | basic_verified`
- `teacherVerificationStatus`: `none | pending_review | approved | rejected`

## Quyền nền tảng
- Người dùng thường:
  - Có thể dùng luồng phổ thông.
  - Không được tạo lớp.
  - Không được tham gia ngân hàng đề.
- Giáo viên chờ duyệt:
  - Có thể nộp hồ sơ xác minh.
  - Chưa có quyền tạo lớp và ngân hàng đề.
- Giáo viên đã duyệt:
  - Được tạo lớp.
  - Được tham gia ngân hàng đề.
- Admin:
  - Có quyền quản trị và duyệt giáo viên.

## Biên giới client-server
- Client chỉ gửi dữ liệu đầu vào.
- Server chuẩn hóa payload và tự gán quyền mặc định.
- Server không nhận `roles` hay `teacherVerificationStatus` từ client để nâng quyền.
- Guard quyền đặt ở `src/server/auth/permissions.ts`.

## Supabase-ready
- `AUTH_ADAPTER_MODE=mock`: dùng kho dữ liệu giả lập an toàn cho local.
- `AUTH_ADAPTER_MODE=supabase`: đã có adapter và server client, nhưng repository Supabase đang placeholder có kiểm soát.
- Không dùng `SUPABASE_SERVICE_ROLE_KEY` ở client.

## Mapping dữ liệu dự kiến cho task SQL
- `users`: id, email, password_hash, roles, account_status, identity_status, teacher_verification_status, timestamps.
- `profiles`: user_id, display_name, full_name, birth_year, school_name, timestamps.
- `teacher_verification_requests`: user_id, hồ sơ xác minh, trạng thái review, admin_note, timestamps.
- `sessions` (nếu không dùng trực tiếp session của Supabase Auth): token, user_id, expires_at.

## Nơi đặt migration
- `db/migrations/` cho migration SQL.
- `db/policies/` cho RLS policy.

