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

// ============================================================
// Lucky Number (4 chữ số, 0001-9999) cho vòng quay may mắn — PHẢI duy nhất
// giữa các khách mời. Việc cấp số THẬT (không trùng) do Google Apps Script
// đảm nhận (xem google-apps-script.gs: generateUniqueLuckyNumber) vì chỉ
// server mới thấy được toàn bộ danh sách đã cấp; hàm dưới đây CHỈ dùng làm
// phương án dự phòng khi không gọi được backend (vd đang chạy dev cục bộ,
// hoặc mất mạng) để app vẫn tạo được thiệp xem trước — số này KHÔNG đảm bảo
// không trùng.
// ============================================================
export function generateFallbackLuckyNumber() {
  return String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
}
