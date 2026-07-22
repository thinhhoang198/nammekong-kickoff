# Hướng dẫn dựng backend lưu lead (Google Sheets + Vercel)

Backend của anh chỉ làm 1 việc: mỗi khi có người tạo thiệp, ghi 1 dòng thông tin họ vào Google Sheet để sale follow-up. Không database, không server riêng, miễn phí.

Luồng hoạt động:

```
App (trình duyệt)
   → POST /api/lead          (serverless function trên Vercel)
   → gọi Google Apps Script  (webhook)
   → ghi 1 dòng vào Sheet
```

Làm theo đúng 3 phần dưới đây, khoảng 15–20 phút.

---

## PHẦN 1 — Tạo Google Sheet + Apps Script (cái "database")

### Bước 1.1. Tạo Sheet

1. Vào https://sheets.google.com tạo 1 sheet mới, đặt tên ví dụ `Leads Thiệp Mời`.
2. Không cần tự kẻ tiêu đề: **mỗi sự kiện sẽ tự sinh ra một tab riêng** (đặt tên
   theo tên sự kiện) kèm dòng tiêu đề dưới đây ngay khi có lead đầu tiên của event đó.

   | A         | B         | C      | D             | E         | F           | G       | H     |
   | --------- | --------- | ------ | ------------- | --------- | ----------- | ------- | ----- |
   | Thời gian | Danh xưng | Họ tên | Số điện thoại | Chức danh | Tên công ty | Sự kiện | Token |

   > Vì vậy khi anh thêm 1 event mới trong `src/data/events.js`, **không cần đụng vào
   > Apps Script** — tab mới sẽ tự xuất hiện. Tab mặc định (Sheet1) có thể để trống.
   >
   > Số điện thoại chỉ lưu trong Sheet để sale liên hệ — **không** in lên thiệp.

### Bước 1.2. Dán Apps Script

1. Trong Sheet, vào menu **Extensions → Apps Script**.
2. Xóa hết code mẫu, dán toàn bộ nội dung file `google-apps-script.gs` (kèm trong gói này).
3. Bấm **Save** (biểu tượng đĩa mềm).

### Bước 1.3. Deploy thành Web App

1. Góc trên phải bấm **Deploy → New deployment**.
2. Bấm bánh răng ⚙ bên cạnh "Select type" → chọn **Web app**.
3. Cấu hình:
   - **Description**: tùy ý (vd "Lead webhook")
   - **Execute as**: `Me` (chính anh)
   - **Who has access**: `Anyone` ← QUAN TRỌNG, để Vercel gọi được
4. Bấm **Deploy**. Lần đầu sẽ hỏi cấp quyền → bấm **Authorize access** → chọn tài khoản Google → "Advanced" → "Go to ... (unsafe)" → Allow. (Cảnh báo này là bình thường vì script do anh tự viết.)
5. Copy **Web app URL** hiện ra — dạng `https://script.google.com/macros/s/AKfyc.../exec`.

   👉 Giữ lại URL này, lát nữa dán vào Vercel.

> Mẹo kiểm tra nhanh: mở URL đó trên trình duyệt, nếu thấy chữ "Lead webhook OK" là script chạy đúng.

---

## PHẦN 2 — Deploy app lên Vercel

### Bước 2.1. Đưa code lên GitHub

1. Tạo 1 repo mới trên github.com (private cũng được).
2. Trong thư mục project, chạy:
   ```bash
   git init
   git add .
   git commit -m "invitation app"
   git branch -M main
   git remote add origin https://github.com/<tài-khoản>/<repo>.git
   git push -u origin main
   ```

### Bước 2.2. Import vào Vercel

1. Vào https://vercel.com đăng nhập bằng GitHub.
2. **Add New → Project** → chọn repo vừa push.
3. Vercel tự nhận đây là Vite project, để nguyên cấu hình mặc định.
4. **KHOAN bấm Deploy** — sang bước 2.3 thêm biến môi trường trước.

### Bước 2.3. Thêm Environment Variable

Vẫn ở màn hình import, mở mục **Environment Variables**, thêm:

| Name                   | Value                      |
| ---------------------- | -------------------------- |
| `GOOGLE_SHEET_WEBHOOK` | dán Web app URL ở Bước 1.3 |

Rồi bấm **Deploy**. Đợi ~1 phút.

> Nếu đã lỡ deploy trước khi thêm biến: vào **Project → Settings → Environment Variables** thêm vào, rồi **Deployments → ... → Redeploy**.

---

## PHẦN 3 — Kiểm tra

1. Mở link Vercel vừa deploy (dạng `https://ten-app.vercel.app`).
2. Tạo thử 1 thiệp với tên giả.
3. Mở lại Google Sheet → phải thấy 1 dòng mới xuất hiện với đầy đủ thông tin.

Nếu thiệp tạo được nhưng Sheet không có dòng mới, xem mục Xử lý lỗi bên dưới.

---

## PHẦN 4 — Check-in bằng QR (đội quét QR dùng)

Mỗi thiệp có 1 mã QR chứa **token** duy nhất của người đó (16 ký tự). Đội quét
QR gọi API sau với token đọc được từ mã QR để xác nhận check-in — API tự tìm
đúng người trên MỌI tab sự kiện (không cần biết trước người đó thuộc sự kiện
nào).

```
POST https://ten-app.vercel.app/api/checkin
Content-Type: application/json

{ "token": "79955ABEC25047A9" }
```

Kết quả:

- **Tìm thấy** → `200 { ok: true, alreadyConfirmed: false, guest: { title, fullName, position, company, eventKey } }`.
  > Sheet hiện không còn cột "Trạng thái" nên `alreadyConfirmed` sẽ luôn là
  > `false` — hệ thống không còn cảnh báo được "đã check-in trước đó" nữa
  > (đã bỏ theo yêu cầu). Field vẫn được giữ trong response để không phá vỡ
  > app quét QR đang đọc field này.
- **Không tìm thấy token** → `404 { error: "Không tìm thấy token này" }`.

App quét QR (Zalo Mini App, web app riêng, hay bất kỳ app nào đọc được QR) chỉ
cần đọc value của mã QR (chính là token) rồi gọi API trên — không cần đụng gì
vào Google Sheet trực tiếp.

---

## Xử lý lỗi thường gặp

**Sheet không nhận được dữ liệu**

- Kiểm tra "Who has access" của Apps Script phải là **Anyone**. Nếu để "Only myself", Vercel bị chặn.
- Mỗi lần sửa code Apps Script, phải **Deploy → Manage deployments → Edit → Version: New version** thì thay đổi mới có hiệu lực (deploy cũ vẫn chạy code cũ).

**Vercel báo "Chưa cấu hình GOOGLE_SHEET_WEBHOOK"**

- Biến môi trường chưa được thêm, hoặc thêm xong chưa Redeploy.

**Muốn xem log lỗi**

- Vercel → Project → **Logs** (hoặc tab Functions) để xem function `/api/lead` hoặc `/api/checkin` chạy ra sao.

**Lead bị trùng / spam**

- App đã tự kiểm tra trùng tên (hoặc tên đại lý, với sự kiện không có tên người) trong đúng tab sự kiện trước khi tạo thiệp. Nếu trùng, popup cho chọn: thay thế dòng cũ / tạo dòng mới / hủy.
- Sau khi cập nhật `google-apps-script.gs`, nhớ **Deploy → Manage deployments → Edit → Version: New version** thì tính năng này mới chạy trên webhook đang dùng.

---

## Mở rộng sau này (khi cần)

- **Gửi email/Zalo thông báo cho sale** mỗi khi có lead mới: thêm vài dòng trong Apps Script (`MailApp.sendEmail`).
- **Lưu cả ảnh thiệp**: cần thêm Cloudinary (file `api/publish.js` ở gói đầu tiên đã có khung sẵn).
- **Dashboard thống kê** theo đại lý/sự kiện: Google Sheet có sẵn Pivot Table, hoặc nối sang Looker Studio để vẽ biểu đồ.
