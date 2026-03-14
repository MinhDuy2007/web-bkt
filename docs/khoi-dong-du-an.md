# Tai lieu khoi dong du an web-bkt

## Muc tieu
- Tao mot nen tang Next.js + TypeScript toi thieu de di tiep cac task sau.
- Giu cau truc ro rang cho frontend, backend, worker va test.

## Lenh co ban
- Cai package: `npm install`
- Chay local: `npm run dev`
- Kiem tra lint: `npm run lint`
- Kiem tra type: `npm run typecheck`
- Chay test auth nen tang: `npm run test:auth`
- Chay test contract schema/policy: `npm run test:schema`
- Kiem tra format: `npm run format:check`

## Quy tac kien truc
- Khong tin frontend cho du lieu nhay cam.
- Auth, phan quyen, xu ly coin, payment, anti-cheat event phai xu ly server-side.
- Worker Python va service Java bao mat de o vung tach biet de de nang cap sau.

## Cau hinh auth hien tai
- `AUTH_ADAPTER_MODE=mock`: dung kho du lieu gia lap an toan cho local.
- `AUTH_ADAPTER_MODE=supabase`: user path chay qua app-service database (`DATABASE_URL`), khong dung service role truc tiep.
- `SESSION_TOKEN_PEPPER`: khoa bi mat de bam `session_token` thanh `token_hash` truoc khi luu DB (bat buoc khai bao rieng khi `AUTH_ADAPTER_MODE=supabase`).
- `SUPABASE_SERVICE_ROLE_KEY`: chi dung cho admin/internal path, khong dung cho user-facing route.
