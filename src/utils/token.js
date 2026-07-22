// ============================================================
// Sinh mã token DUY NHẤT cho mỗi người khi tạo thiệp — dùng làm
// giá trị mã QR check-in in trên thiệp, đồng thời lưu vào cột
// "Token" trên Google Sheet để đối soát khi quét.
// ============================================================

/** Token 16 ký tự hex viết hoa, vd: "3F2A9C8E1B4D5601". */
export function generateToken() {
  const raw =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return raw.replace(/-/g, '').toUpperCase().slice(0, 16);
}
