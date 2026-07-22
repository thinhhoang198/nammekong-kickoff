// ============================================================
// Gọi serverless API để LƯU LEAD vào Google Sheets.
// Chỉ gửi thông tin form (JSON), không gửi ảnh.
//
// Nếu backend chưa cấu hình / lỗi -> ném lỗi, nhưng app vẫn
// cho tải ảnh bình thường (xem App.jsx bắt lỗi này).
// ============================================================

export async function saveLead(formData) {
  const res = await fetch("/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Lưu lead thất bại");
  }
  return res.json();
}

// Tra trùng tên/đại lý trong tab Sheet của 1 sự kiện, trước khi tạo thiệp.
// Trả về { ok, matches: [{ title, fullName, position, company }] }.
export async function checkDuplicateLead({ eventKey, eventLabel, matchField, matchValue }) {
  const res = await fetch("/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "check", eventKey, eventLabel, matchField, matchValue }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Kiểm tra trùng thất bại");
  }
  return res.json();
}
