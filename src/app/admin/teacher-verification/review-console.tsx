"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/app/admin/teacher-verification/page.module.css";

type TrangThaiYeuCau = "pending_review" | "approved" | "rejected";
type TrangThaiLoc = "all" | TrangThaiYeuCau;
type HanhDongReview = "approve" | "reject";

type ItemDanhSach = {
  request: {
    id: string;
    userId: string;
    fullName: string;
    schoolName: string;
    teachingSubjects: string[];
    evidenceNote: string;
    evidenceUrls: string[];
    status: TrangThaiYeuCau;
    submittedAt: string;
    reviewedByUserId: string | null;
    reviewedAt: string | null;
    adminNote: string | null;
    createdAt: string;
    updatedAt: string;
  };
  account: {
    id: string;
    email: string;
    roles: string[];
    accountStatus: string;
    identityStatus: string;
    teacherVerificationStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  profile: {
    userId: string;
    displayName: string;
    fullName: string;
    birthYear: number | null;
    schoolName: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type DuLieuDanhSach = {
  items: ItemDanhSach[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type PhanHoiApiDanhSach =
  | {
      ok: true;
      data: DuLieuDanhSach;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type PhanHoiApiReview =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type ThongBao = {
  type: "success" | "error";
  message: string;
};

const LIMIT_MAC_DINH = 12;

function dinhDangNgayGio(iso: string | null): string {
  if (!iso) {
    return "Chưa có";
  }

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "Không xác định";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function layNhanTrangThai(status: TrangThaiYeuCau): string {
  if (status === "pending_review") {
    return "Chờ duyệt";
  }

  if (status === "approved") {
    return "Đã duyệt";
  }

  return "Từ chối";
}

function layClassTrangThai(status: TrangThaiYeuCau): string {
  if (status === "pending_review") {
    return `${styles.status} ${styles.statusPending}`;
  }

  if (status === "approved") {
    return `${styles.status} ${styles.statusApproved}`;
  }

  return `${styles.status} ${styles.statusRejected}`;
}

export function BangDieuKhienDuyetXacMinhGiaoVien() {
  const [trangThaiLoc, setTrangThaiLoc] = useState<TrangThaiLoc>("pending_review");
  const [trang, setTrang] = useState(1);
  const [duLieu, setDuLieu] = useState<DuLieuDanhSach | null>(null);
  const [dangTai, setDangTai] = useState(true);
  const [loiTai, setLoiTai] = useState<string | null>(null);
  const [thongBao, setThongBao] = useState<ThongBao | null>(null);
  const [taiLaiKey, setTaiLaiKey] = useState(0);
  const [ghiChuTheoRequestId, setGhiChuTheoRequestId] = useState<Record<string, string>>({});
  const [dangXuLy, setDangXuLy] = useState<{
    requestId: string;
    action: HanhDongReview;
  } | null>(null);

  useEffect(() => {
    let daHuy = false;
    const controller = new AbortController();

    async function taiDanhSach() {
      setDangTai(true);
      setLoiTai(null);

      try {
        const query = new URLSearchParams({
          status: trangThaiLoc,
          page: String(trang),
          limit: String(LIMIT_MAC_DINH),
        });
        const response = await fetch(
          `/api/admin/teacher-verification/requests?${query.toString()}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const body = (await response.json()) as PhanHoiApiDanhSach;

        if (!response.ok || !body.ok) {
          const message = body.ok
            ? "Không thể tải danh sách yêu cầu."
            : body.error.message;
          throw new Error(message);
        }

        if (daHuy) {
          return;
        }

        setDuLieu(body.data);
        if (body.data.pagination.totalPages > 0 && trang > body.data.pagination.totalPages) {
          setTrang(body.data.pagination.totalPages);
        }
      } catch (error) {
        if (daHuy) {
          return;
        }

        const message = error instanceof Error ? error.message : "Không thể tải dữ liệu.";
        setLoiTai(message);
      } finally {
        if (!daHuy) {
          setDangTai(false);
        }
      }
    }

    void taiDanhSach();
    return () => {
      daHuy = true;
      controller.abort();
    };
  }, [taiLaiKey, trang, trangThaiLoc]);

  const tongTrang = duLieu?.pagination.totalPages ?? 0;
  const coDuLieu = (duLieu?.items.length ?? 0) > 0;
  const dangXuLyYeuCau = useMemo(() => dangXuLy?.requestId ?? null, [dangXuLy]);

  async function xuLyReview(requestId: string, action: HanhDongReview) {
    const adminNote = (ghiChuTheoRequestId[requestId] ?? "").trim();
    setThongBao(null);
    setDangXuLy({ requestId, action });

    try {
      const response = await fetch(
        `/api/admin/teacher-verification/${requestId}/review`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            action,
            adminNote: adminNote.length > 0 ? adminNote : null,
          }),
        },
      );
      const body = (await response.json()) as PhanHoiApiReview;
      if (!response.ok || !body.ok) {
        const message = body.ok ? "Không thể xử lý yêu cầu." : body.error.message;
        throw new Error(message);
      }

      setThongBao({
        type: "success",
        message:
          action === "approve"
            ? "Đã duyệt yêu cầu xác minh giáo viên."
            : "Đã từ chối yêu cầu xác minh giáo viên.",
      });
      setTaiLaiKey((oldValue) => oldValue + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể xử lý yêu cầu.";
      setThongBao({
        type: "error",
        message,
      });
    } finally {
      setDangXuLy(null);
    }
  }

  return (
    <section>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <label className={styles.label} htmlFor="filter-status">
            Trạng thái:
          </label>
          <select
            id="filter-status"
            className={styles.select}
            value={trangThaiLoc}
            onChange={(event) => {
              setTrang(1);
              setTrangThaiLoc(event.target.value as TrangThaiLoc);
            }}
            disabled={dangXuLy !== null}
          >
            <option value="pending_review">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Đã từ chối</option>
            <option value="all">Tất cả</option>
          </select>
        </div>

        <button
          type="button"
          className={styles.button}
          onClick={() => setTaiLaiKey((oldValue) => oldValue + 1)}
          disabled={dangTai || dangXuLy !== null}
        >
          {dangTai ? "Đang tải..." : "Làm mới danh sách"}
        </button>
      </div>

      {thongBao ? (
        <p
          className={`${styles.inlineMessage} ${
            thongBao.type === "success"
              ? styles.inlineMessageSuccess
              : styles.inlineMessageError
          }`}
        >
          {thongBao.message}
        </p>
      ) : null}

      {dangTai && !duLieu ? (
        <section className={styles.loadingState}>Đang tải danh sách yêu cầu...</section>
      ) : null}

      {loiTai ? (
        <section className={styles.errorState}>
          <p>{loiTai}</p>
          <button
            type="button"
            className={styles.button}
            onClick={() => setTaiLaiKey((oldValue) => oldValue + 1)}
          >
            Tải lại
          </button>
        </section>
      ) : null}

      {!dangTai && !loiTai && duLieu && !coDuLieu ? (
        <section className={styles.emptyState}>
          <p>Không có yêu cầu nào khớp với bộ lọc hiện tại.</p>
        </section>
      ) : null}

      {!dangTai && !loiTai && duLieu && coDuLieu ? (
        <div className={styles.cards}>
          {duLieu.items.map((item) => {
            const request = item.request;
            const tenHienThi = item.profile?.fullName ?? request.fullName;
            const dangXuLyCard = dangXuLyYeuCau === request.id;

            return (
              <article key={request.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div>
                    <h2 className={styles.name}>{tenHienThi}</h2>
                    <p className={styles.meta}>{item.account.email}</p>
                    <p className={styles.meta}>
                      Gửi lúc: {dinhDangNgayGio(request.submittedAt)}
                    </p>
                  </div>
                  <span className={layClassTrangThai(request.status)}>
                    {layNhanTrangThai(request.status)}
                  </span>
                </div>

                <p className={styles.meta}>Trường: {request.schoolName}</p>
                <p className={styles.subjects}>
                  Môn giảng dạy: {request.teachingSubjects.join(", ")}
                </p>
                <p className={styles.meta}>Mô tả minh chứng: {request.evidenceNote}</p>

                {request.status === "pending_review" ? (
                  <>
                    <textarea
                      className={styles.noteInput}
                      placeholder="Ghi chú quản trị (tùy chọn)"
                      value={ghiChuTheoRequestId[request.id] ?? ""}
                      onChange={(event) =>
                        setGhiChuTheoRequestId((oldValue) => ({
                          ...oldValue,
                          [request.id]: event.target.value,
                        }))
                      }
                      disabled={dangXuLyCard}
                    />
                    <div className={styles.reviewActions}>
                      <button
                        type="button"
                        className={`${styles.button} ${styles.buttonSuccess}`}
                        onClick={() => void xuLyReview(request.id, "approve")}
                        disabled={dangXuLy !== null}
                      >
                        {dangXuLyCard && dangXuLy?.action === "approve"
                          ? "Đang duyệt..."
                          : "Duyệt"}
                      </button>
                      <button
                        type="button"
                        className={`${styles.button} ${styles.buttonDanger}`}
                        onClick={() => void xuLyReview(request.id, "reject")}
                        disabled={dangXuLy !== null}
                      >
                        {dangXuLyCard && dangXuLy?.action === "reject"
                          ? "Đang từ chối..."
                          : "Từ chối"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className={styles.meta}>
                    Đã xử lý lúc {dinhDangNgayGio(request.reviewedAt)}.
                    {request.adminNote ? ` Ghi chú: ${request.adminNote}` : ""}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : null}

      {!dangTai && !loiTai && tongTrang > 1 && duLieu ? (
        <div className={styles.paging}>
          <p className={styles.pagingInfo}>
            Trang {duLieu.pagination.page}/{duLieu.pagination.totalPages} • Tổng{" "}
            {duLieu.pagination.total} yêu cầu
          </p>
          <div className={styles.pagingButtons}>
            <button
              type="button"
              className={styles.button}
              disabled={trang <= 1 || dangTai || dangXuLy !== null}
              onClick={() => setTrang((oldValue) => Math.max(oldValue - 1, 1))}
            >
              Trang trước
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={trang >= tongTrang || dangTai || dangXuLy !== null}
              onClick={() =>
                setTrang((oldValue) => Math.min(oldValue + 1, tongTrang))
              }
            >
              Trang sau
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
