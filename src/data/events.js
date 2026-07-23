// ============================================================
// CẤU HÌNH SỰ KIỆN — đây là file QUAN TRỌNG NHẤT.
// Mỗi event định nghĩa: ảnh nền + FORM nhập liệu + vị trí (toạ độ)
// từng dòng chữ sẽ được vẽ đè lên ảnh.
//
// Khi có event mới: chỉ cần thêm 1 object vào đây + bỏ banner
// vào /public/assets — KHÔNG cần sửa code component nào khác.
//
// Toạ độ x, y tính theo pixel TRÊN ẢNH GỐC (canvasSize), không
// phải theo màn hình. Gốc (0,0) ở góc trên-trái.
//
// Field text ghép từ nhiều giá trị form qua "from" (mảng key), nối bằng
// "separator" (mặc định là dấu cách " ") — bỏ qua field rỗng.
//
// Các field type đặc biệt (không phải text):
//   type: "gradient-overlay" — dải tối dần để tăng tương phản
//   type: "line"             — đường kẻ ngang trang trí
//   type: "image"             — chèn ảnh tĩnh có sẵn (vd: QR dựng sẵn trong /public/assets)
//     src             : đường dẫn ảnh
//     size            : cạnh vuông ảnh (px, theo canvasSize)
//     margin          : khoảng cách tới mép ảnh, dùng chung cho cả X và Y
//                        (khi không truyền x/y — mặc định neo góc dưới-phải)
//     marginX, marginY: khoảng cách riêng theo từng trục — ghi đè margin,
//                        dùng khi cần lệch vị trí theo chiều ngang/dọc
//     anchor          : góc neo — "bottom-right" (mặc định), "bottom-left",
//                        "top-left", "top-right"
//     x, y            : (tuỳ chọn) đặt vị trí cố định thay vì neo theo margin
//   type: "qr"                — mã QR sinh ĐỘNG lúc vẽ (khác "image" là ảnh
//     tĩnh có sẵn). Value lấy từ data[valueKey] (mặc định data.token — xem
//     src/utils/token.js).
//     valueKey        : key trong data chứa giá trị mã hoá (mặc định "token")
//     size            : cạnh vuông hiển thị (px, theo canvasSize)
//     x, y            : vị trí — mép trên-trái; nếu align:"center" thì x là
//                        TÂM ngang
//     align           : "center" để x là tâm ngang (mặc định mép trái)
//     qrPixelSize     : độ phân giải nội bộ lúc sinh QR (mặc định size*3,
//                        để nét khi in/zoom)
//
// ------------------------------------------------------------
// FORM RIÊNG CHO TỪNG EVENT
// ------------------------------------------------------------
// Mỗi event có một mảng "form" mô tả các ô nhập + validation. Nhờ đó
// mỗi sự kiện có một bộ form khác nhau mà KHÔNG cần sửa component.
//
// form: [ <row>, <row>, ... ]
//   Mỗi row hiển thị 1 nhãn (label) và 1 hoặc nhiều ô nhập trên cùng hàng.
//
//   row = {
//     label : nhãn hiển thị phía trên hàng
//     inputs: [ <input>, ... ]   // 1 ô = full width; nhiều ô = chia đều hàng
//   }
//
//   input = {
//     name       : key lưu vào form data (khớp với "from" trong fields ở trên)
//     type       : 'text' | 'select'  (mặc định 'text')
//     options    : mảng lựa chọn (bắt buộc khi type='select')
//     placeholder: gợi ý trong ô nhập
//     required   : true => bắt buộc nhập mới cho phép tạo thiệp
//     numeric    : true => chỉ cho gõ chữ số (vd: số điện thoại)
//     maxLength  : giới hạn số ký tự tối đa; nếu kèm required, phải gõ
//                  ĐỦ đúng số ký tự này mới hợp lệ (không cho thiếu/thừa)
//   }
// ============================================================

import { TITLES } from './agencies';

export const EVENTS = {
  'kickoff-300726': {
    label: 'SỰ KIỆN KICK-OFF DỰ ÁN NAM MEKONG GRAND PLAZA',
    bgImage: '/assets/kickoff.jpg',
    canvasSize: { width: 2560, height: 2210 },
    form: [
      {
        label: 'Họ và tên',
        inputs: [
          {
            name: 'title',
            type: 'select',
            options: TITLES,
            placeholder: 'Danh xưng',
            required: true,
          },
          {
            name: 'fullName',
            type: 'text',
            placeholder: 'NGUYỄN VĂN A',
            required: true,
          },
        ],
      },
      {
        label: 'Số điện thoại (5 số cuối)',
        inputs: [
          {
            name: 'phone',
            type: 'text',
            inputMode: 'numeric',
            numeric: true,
            maxLength: 5,
            placeholder: 'VD: 5 số cuối là 12345',
            required: true,
          },
        ],
      },
      {
        label: 'Chức danh',
        inputs: [
          {
            name: 'position',
            type: 'text',
            placeholder: 'VD: GIÁM ĐỐC KINH DOANH',
            required: true,
          },
        ],
      },
      {
        label: 'Tên công ty / Đại lý',
        inputs: [
          {
            name: 'company',
            type: 'text',
            placeholder: 'VD: NAM MEKONG GROUP',
            required: true,
          },
        ],
      },
    ],
    // Toạ độ đo trực tiếp trên kickoff.jpg (2560x2210): khối chữ khách mời
    // nằm giữa 2 dòng tĩnh có sẵn trên nền "Trân trọng kính mời" (baseline
    // ~y383) và "tới tham dự" (baseline ~y596), canh giữa cột trái (centerX 690).
    // Không in số điện thoại lên thiệp — chỉ gửi kèm về Google Sheet.
    fields: {
      fullName: {
        from: ['title', 'fullName'],
        uppercase: true,
        x: 690,
        y: 450,
        font: "500 50px 'SVN-Gotham'",
        color: '#ffc5b8',
        align: 'center',
        maxWidth: 1150,
      },
      position: {
        from: ['position'],
        uppercase: true,
        x: 690,
        y: 498,
        font: "400 30px 'SVN-Gotham'",
        color: '#ffc5b8',
        align: 'center',
        maxWidth: 1150,
      },
      company: {
        from: ['company'],
        uppercase: true,
        x: 690,
        y: 539,
        font: "400 30px 'SVN-Gotham'",
        color: '#ffc5b8',
        align: 'center',
        maxWidth: 1150,
      },
      qr: {
        type: 'qr',
        valueKey: 'token',
        x: 1980,
        y: 1750,
        align: 'center',
        valign: 'center',
        size: 350,
      },
      // Số quay số trúng thưởng — in ngay dưới mã QR (xem App.jsx: luckyLabel
      // dựng sẵn "Lucky Number: XXXX", field ở đây chỉ in thẳng ra).
      luckyNumber: {
        from: ['luckyLabel'],
        x: 1980,
        y: 1540,
        font: "500 36px 'SVN-Gotham'",
        color: '#ffc5b8',
        align: 'center',
      },
    },
  },
};
