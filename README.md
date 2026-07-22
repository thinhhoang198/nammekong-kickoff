# Trang tạo thiệp mời cá nhân hóa (React + Vite + Google Sheets)

Người dùng nhập thông tin → render ảnh thiệp cá nhân hóa → tải về.
Đồng thời thông tin được lưu vào Google Sheets để sale follow-up lead.

## Chạy local
```bash
npm install
npm run dev
```
Mở http://localhost:5173. Phần tạo + tải ảnh chạy ngay không cần backend.

## Dựng backend lưu lead
👉 Xem hướng dẫn từng bước trong **BACKEND-SETUP.md** (Google Sheets + Vercel, ~15 phút).
File `google-apps-script.gs` là code dán sẵn vào Google Apps Script.

## Cấu trúc
```
src/
  data/events.js        # ⭐ config sự kiện: banner + toạ độ chữ
  data/agencies.js      # danh sách đại lý
  utils/canvas.js       # lõi vẽ thiệp (đã xử lý font tiếng Việt)
  utils/api.js          # gọi /api/lead lưu Google Sheets
  components/
  App.jsx
public/assets/          # banner từng event (đang là placeholder)
api/lead.js             # serverless: nhận lead -> đẩy sang Sheet
google-apps-script.gs   # code cho Apps Script
BACKEND-SETUP.md        # hướng dẫn dựng backend
```

## Thêm sự kiện mới
1. Bỏ banner vào `public/assets/banner-xxx.jpg` (1080×1350px).
2. Thêm 1 block vào `src/data/events.js`, chỉnh toạ độ x,y cho khớp banner.
Không cần sửa code component.

## Biến môi trường (Vercel)
| Name | Value |
|---|---|
| `GOOGLE_SHEET_WEBHOOK` | URL Web App của Google Apps Script |
