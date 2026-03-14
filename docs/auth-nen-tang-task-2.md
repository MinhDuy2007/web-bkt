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
- `APP_ORIGIN`: origin chuẩn cho browser mutation guard (Origin/Referer check).

## Session transport (browser)
- Browser flow dùng cookie `session_token` (`HttpOnly`, `SameSite=Strict`) làm đường chính.
- Login và session route chỉ trả dữ liệu session công khai (`issuedAt`, `expiresAt`, `user`, `profile`).
- Không trả raw session token trong JSON body hoặc `x-session-token` response header cho browser flow.

## CSRF và origin protection
- Các browser mutation route dùng cookie auth phải kiểm tra `Origin/Referer`.
- Nếu origin không khớp `APP_ORIGIN` (hoặc origin của request URL khi chưa cấu hình `APP_ORIGIN`) thì chặn với `403`.
- Route đã áp dụng: login browser flow, gửi yêu cầu xác minh giáo viên.

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

## DB least-privilege cho user-facing path
- Hiện user-facing app path dùng `DATABASE_URL` để truy cập Postgres.
- Có thể khóa cứng kỳ vọng bằng `DATABASE_EXPECTED_USER` để phát hiện sai user DB ngay khi khởi tạo pool.
- Nếu `DATABASE_URL` đang trỏ vào role có quyền rộng (DDL/owner/superuser) thì vẫn còn rủi ro vượt quyền khi app-layer có lỗi.
- Mục tiêu vận hành: dùng role DB riêng cho app path, chỉ `SELECT/INSERT/UPDATE/DELETE` trên bảng cần thiết, không cấp quyền thay đổi schema.

## Nơi đặt SQL
- `db/migrations/`: migration schema, function, trigger, hardening.
- `db/policies/`: policy RLS.

## Luồng admin review (Task 4)
- Route admin-only:
  - `POST /api/admin/teacher-verification/:requestId/review`
- Payload:
  - `action`: `approve | reject`
  - `adminNote`: tùy chọn
- Guard bắt buộc:
  - Cookie session hợp lệ (`session_token`)
  - Origin/Referer check cho browser mutation
  - `batBuocQuyenAdmin` ở server-side
- Khi `approve`:
  - `teacher_verification_requests.status = approved`
  - set `reviewed_by`, `reviewed_at`, `admin_note`
  - `user_accounts.teacher_verification_status = approved`
  - đảm bảo role `teacher` được phản ánh trên account
- Khi `reject`:
  - `teacher_verification_requests.status = rejected`
  - set `reviewed_by`, `reviewed_at`, `admin_note`
  - `user_accounts.teacher_verification_status = rejected`
  - loại role `teacher` khỏi account nếu có
- Chặn review lại:
  - chỉ cho phép review khi request đang `pending_review`
- Audit log:
  - trigger ghi `teacher_verification_audit_logs`
  - actor ưu tiên `auth.uid()`, fallback sang `new.reviewed_by` để đúng actor trong custom auth path.
