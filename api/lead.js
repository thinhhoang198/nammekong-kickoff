// ============================================================
// /api/lead — Vercel Serverless Function.
// Nhiệm vụ DUY NHẤT: nhận thông tin người tạo thiệp (lead)
// rồi đẩy sang Google Sheets để sale follow-up.
//
// Không upload ảnh, không xử lý Facebook — đúng nhu cầu lưu lead.
//
// Cấu hình 1 biến môi trường trên Vercel (xem BACKEND-SETUP.md):
//   GOOGLE_SHEET_WEBHOOK = URL Web App của Google Apps Script
// ============================================================

export default async function handler(req, res) {
  // Cho phép gọi từ trình duyệt (CORS) — an toàn vì chỉ ghi, không đọc
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Chỉ nhận POST' });
  }

  const webhook = process.env.GOOGLE_SHEET_WEBHOOK;
  if (!webhook) {
    return res
      .status(500)
      .json({ error: 'Chưa cấu hình GOOGLE_SHEET_WEBHOOK' });
  }

  const body = req.body || {};
  const action = body.action === 'check' || body.action === 'update' ? body.action : 'create';

  try {
    // --- Kiểm tra trùng tên (chỉ đọc, không ghi) ---
    if (action === 'check') {
      const { eventKey, eventLabel, matchField, matchValue } = body;
      if (!eventKey || !matchField || !matchValue) {
        return res.status(400).json({ error: 'Thiếu thông tin kiểm tra trùng' });
      }

      const sheetRes = await fetch(webhook, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check',
          eventKey,
          eventLabel: eventLabel || '',
          matchField,
          matchValue,
        }),
      });

      const data = await sheetRes.json().catch(() => ({}));
      if (!sheetRes.ok || data.ok === false) {
        throw new Error(data.error || `Google Sheet từ chối (${sheetRes.status})`);
      }

      return res.status(200).json({ ok: true, matches: data.matches || [] });
    }

    // --- Tạo mới hoặc thay thế (ghi vào Sheet) ---
    const { title, fullName, phone, position, company, token, eventKey, eventLabel, matchRecord } = body;

    // Validate tối thiểu. Mỗi event có form khác nhau nên KHÔNG bắt buộc
    // fullName — chỉ cần eventKey + ít nhất 1 trường định danh (tên người
    // hoặc tên đại lý). VD: Thư cảm ơn chỉ nhập company.
    if (!eventKey || (!fullName && !company)) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }

    // Đẩy sang Google Apps Script -> ghi (hoặc ghi đè) 1 dòng vào Sheet
    const sheetRes = await fetch(webhook, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        time: new Date().toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        }),
        title: title || '',
        fullName: fullName || '',
        phone: phone || '',
        position: position || '',
        company: company || '',
        token: token || '',
        eventKey,
        eventLabel: eventLabel || '',
        matchRecord: action === 'update' ? matchRecord || null : null,
      }),
    });

    if (!sheetRes.ok) {
      const errBody = await sheetRes.text().catch(() => '(no body)');
      console.error(
        `Google Sheet lỗi: status=${sheetRes.status}, body=${errBody}`,
      );
      throw new Error(`Google Sheet từ chối ghi (${sheetRes.status})`);
    }

    const data = await sheetRes.json().catch(() => ({}));
    if (data.ok === false) {
      throw new Error(data.error || 'Google Sheet từ chối ghi');
    }

    // luckyNumber do Apps Script cấp (duy nhất trong tab) — trả về để app vẽ
    // lên thiệp, xem src/App.jsx.
    return res.status(200).json({ ok: true, luckyNumber: data.luckyNumber || '' });
  } catch (err) {
    console.error('Lưu lead lỗi:', err);
    return res
      .status(500)
      .json({ error: action === 'check' ? 'Không kiểm tra được trùng' : 'Không lưu được lead' });
  }
}
