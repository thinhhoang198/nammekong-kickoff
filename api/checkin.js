// ============================================================
// /api/checkin — Vercel Serverless Function.
// Dùng cho ứng dụng của ĐỘI QUÉT QR: nhận token đọc được từ mã QR
// trên thiệp, tìm đúng người trong Google Sheet (quét mọi tab sự
// kiện) rồi đổi cột "Trạng thái" từ "Chờ xác nhận" sang "Đã xác
// nhận". Trả về thông tin khách để app quét hiển thị xác nhận.
//
// Dùng chung 1 biến môi trường GOOGLE_SHEET_WEBHOOK với /api/lead
// (xem BACKEND-SETUP.md).
// ============================================================

export default async function handler(req, res) {
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

  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: 'Thiếu token' });
  }

  try {
    const sheetRes = await fetch(webhook, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'checkin', token }),
    });

    const data = await sheetRes.json().catch(() => ({}));
    if (!sheetRes.ok || data.ok === false) {
      throw new Error(data.error || `Google Sheet từ chối (${sheetRes.status})`);
    }

    if (!data.found) {
      return res.status(404).json({ error: 'Không tìm thấy token này' });
    }

    return res.status(200).json({
      ok: true,
      alreadyConfirmed: !!data.alreadyConfirmed,
      guest: {
        title: data.title || '',
        fullName: data.fullName || '',
        position: data.position || '',
        company: data.company || '',
        eventKey: data.eventKey || '',
      },
    });
  } catch (err) {
    console.error('Check-in lỗi:', err);
    return res.status(500).json({ error: 'Không xác nhận được check-in' });
  }
}
