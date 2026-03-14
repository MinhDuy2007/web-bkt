# Auth Nền Tảng (Task 2, đồng bộ đến Task 003A)

## Mục tiêu
- Khóa biên giới client-server cho xác thực và phân quyền.
- Tách rõ 3 lớp trạng thái: trạng thái tài khoản, xác minh người dùng cơ bản, xác minh giáo viên.
- Giữ hướng triển khai **Hướng A = custom auth**: runtime authorization chính ở application layer server-side.

## Vai trò
- `admin`: quản trị hệ thống quyền và duyệt xác minh giáo viên.
- `teacher`: chỉ có quyền giáo viên thực thụ khi `teacherVerificationStatus = approved`.
- `student`: vai trò học sinh.
- `user`: vai trò người dùng phổ thông.

## Trạng thái
- `accountStatus`: `active | suspended | pending`
- `identityStatus`: `unverified | basic_verified`
- `teacherVerificationStatus`: `none | pending_review | approved | rejected`

## Ranh giới quyền
- Người dùng thường:
  - Có thể dùng tính năng phổ thông.
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

## Hướng A và biên giới runtime security
- `application-layer authorization` là lớp runtime chính:
  - Chuẩn hóa payload.
  - Resolve session.
  - Guard quyền tại `src/server/auth/service.ts` và `src/server/auth/permissions.ts`.
- `DB-layer protection (RLS)` là lớp phòng thủ phụ:
  - Bảo vệ ownership và dữ liệu nhạy cảm ở tầng DB.
  - Không được mô tả là bằng chứng runtime authorization chính cho user path khi request đi qua service-role.
- `service role` bị bó vùng:
  - Chỉ dùng ở admin/internal path qua `layAuthAdminRepository`.
  - Không dùng trực tiếp cho user-facing route.

## Supabase-ready theo boundary mới
- `AUTH_ADAPTER_MODE=mock`: dùng kho giả lập cho local.
- `AUTH_ADAPTER_MODE=supabase`: user-facing repository chạy qua app-service DB path (`DATABASE_URL`) thay vì service-role path.
- `AUTH_ADAPTER_MODE=supabase` bắt buộc khai báo `SESSION_TOKEN_PEPPER` riêng (không dùng fallback dev).
- `SUPABASE_SERVICE_ROLE_KEY`: chỉ dùng cho admin/internal modules.

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
  - session ứng dụng chỉ lưu `token_hash`; không lưu token thô.

## Nơi đặt SQL
- `db/migrations/`: migration schema, function, trigger, hardening.
- `db/policies/`: policy RLS.
