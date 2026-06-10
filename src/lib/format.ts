export function formatRupiah(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  unpaid: "Belum Dibayar",
  partial: "Sebagian Dibayar",
  paid: "Lunas",
  expired: "Kadaluarsa",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu Pembayaran",
  settlement: "Berhasil",
  capture: "Berhasil",
  expire: "Kadaluarsa",
  cancel: "Dibatalkan",
  deny: "Ditolak",
  failure: "Gagal",
  refund: "Refund",
};
