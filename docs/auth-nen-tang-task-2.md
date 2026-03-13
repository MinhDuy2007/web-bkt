# Auth Nền Tảng Task 2 (Đồng Bộ Sau Task 3)

## Mục tiêu
- Khóa biên giới client-server cho xác thực và phân quyền.
- Tách rõ 3 lớp trạng thái: tài khoản, xác minh cơ bản, xác minh giáo viên.
- Chuẩn bị sẵn cấu trúc để nối Supabase thật theo từng phần.

## Vai trò
- `admin`: quản trị hệ thống quyền và duyệt xác minh giáo viên.
- `teacher`: vai trò giáo viên, chỉ có quyền giáo viên thực thụ khi `teacherVerificationStatus = approved`.
- `student`: vai trò học sinh.
- `user`: vai trò người dùng phổ thông.

## Trạng thái
- `accountStatus`: `active | suspended | pending`
- `identityStatus`: `unverified | basic_verified`
- `teacherVerificationStatus`: `none | pending_review | approved | rejected`

## Ranh giới quyền
- Người dùng thường:
  - Có thể dùng luồng phổ thông.
  - Không được tạo lớp.
  - Không được tham gia ngân hàng đề.
- Giáo viên chờ duyệt:
  - Có thể gửi hồ sơ xác minh.
  - Chưa có quyền giáo viên thực thụ.
- Giáo viên đã duyệt:
  - Được tạo lớp.
  - Được tham gia ngân hàng đề.
- Admin:
  - Có quyền duyệt hoặc từ chối hồ sơ xác minh giáo viên.

## Biên giới client-server
- Client chỉ gửi dữ liệu đầu vào.
- Server chuẩn hóa payload và tự gán giá trị nhạy cảm.
- Server không nhận vai trò hoặc trạng thái từ client để nâng quyền.
- Guard quyền đặt ở `src/server/auth/permissions.ts`.

## Supabase-ready
- `AUTH_ADAPTER_MODE=mock`: dùng kho dữ liệu giả lập cho local.
- `AUTH_ADAPTER_MODE=supabase`: dùng repository dữ liệu thật trên Supabase cho các phần đã có schema.
- `SUPABASE_SERVICE_ROLE_KEY` chỉ dùng ở server, không lộ ra client.

## Mapping dữ liệu đã chốt
- `user_accounts`
  - metadata tài khoản ứng dụng: `email`, `password_hash`, `roles`, `account_status`, `identity_status`, `teacher_verification_status`.
- `user_profiles`
  - hồ sơ cá nhân 1-1 với tài khoản: `display_name`, `full_name`, `birth_year`, `school_name`, `bio`, `avatar_url`.
- `teacher_verification_requests`
  - hồ sơ xác minh giáo viên và kết quả review: `status`, `reviewed_by`, `reviewed_at`, `admin_note`.
- `teacher_verification_audit_logs`
  - nhật ký hành vi nhạy cảm trong luồng xác minh giáo viên.
- `app_sessions`
  - phiên ứng dụng tối thiểu cho luồng auth hiện tại.

## Nơi đặt SQL
- `db/migrations/`: migration schema và trigger/function.
- `db/policies/`: policy RLS.
