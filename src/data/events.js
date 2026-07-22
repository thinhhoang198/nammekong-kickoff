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
//   }
// ============================================================

import { TITLES } from './agencies';

export const EVENTS = {
  // Vùng trống trong event1.png: y≈1000–1350 (350px dark navy)
  // Toàn bộ text overlay đặt vào khu vực này.
  // 'saban-08072026': {
  //   label: 'Sự Kiện Ra Mắt Sa Bàn (08/07/2026)',
  //   bgImage: '/assets/saban-event.jpg',
  //   canvasSize: { width: 2480, height: 3720 },
  //   form: [
  //     {
  //       label: 'Họ và tên',
  //       inputs: [
  //         {
  //           name: 'title',
  //           type: 'select',
  //           options: TITLES,
  //           placeholder: 'Danh xưng',
  //           required: true,
  //         },
  //         {
  //           name: 'fullName',
  //           type: 'text',
  //           placeholder: 'Nguyễn Văn A',
  //           required: true,
  //         },
  //       ],
  //     },
  //     {
  //       label: 'Chức danh',
  //       inputs: [
  //         {
  //           name: 'position',
  //           type: 'text',
  //           placeholder: 'VD: Giám đốc Kinh doanh',
  //           required: true,
  //         },
  //       ],
  //     },
  //     {
  //       label: 'Tên công ty / Đại lý',
  //       inputs: [
  //         {
  //           name: 'company',
  //           type: 'text',
  //           placeholder: 'VD: Nam Mekong Group',
  //           required: true,
  //         },
  //       ],
  //     },
  //   ],
  //   fields: {
  //     fullName: {
  //       from: ['title', 'fullName'],
  //       uppercase: true,
  //       x: 210,
  //       y: 770,
  //       font: "500 66px 'SVN-Gotham'",
  //       color: '#f5b5ff',
  //       align: 'left',
  //       maxWidth: 1540,
  //     },
  //     position: {
  //       from: ['position'],
  //       x: 210,
  //       y: 860,
  //       font: "500 62px 'SVN-Gotham'",
  //       color: '#f5b5ff',
  //       align: 'left',
  //       maxWidth: 1540,
  //     },
  //     company: {
  //       from: ['company'],
  //       x: 210,
  //       y: 950,
  //       font: "500 62px 'SVN-Gotham'",
  //       color: '#f5b5ff',
  //       align: 'left',
  //       maxWidth: 1540,
  //     },
  //     qr: {
  //       type: 'image',
  //       src: '/assets/qr-code.png',
  //       anchor: 'bottom-left',
  //       size: 320,
  //       marginX: 220,
  //       marginY: 320,
  //     },
  //   },
  // },
  'daily-16072026': {
    label: 'Sự Kiện Gặp Mặt Đại Lý (16/07/2026)',
    bgImage: '/assets/dai-ly.png',
    canvasSize: { width: 2480, height: 3652 },
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
            placeholder: 'Nguyễn Văn A',
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
            placeholder: 'VD: Giám đốc Kinh doanh',
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
            placeholder: 'VD: Nam Mekong Group',
            required: true,
          },
        ],
      },
    ],
    fields: {
      // "Nhân xưng" + "Tên" trên cùng 1 dòng, canh baseline chung, mỗi
      // đoạn cỡ chữ riêng (danh xưng nhỏ, tên to nổi bật).
      fullName: {
        type: 'multi-text',
        x: 1235,
        y: 660,
        align: 'center',
        gap: 36,
        segments: [
          {
            from: ['title'],
            font: "400 90px '1FTV VIP Glasvia'",
            color: '#f7c978',
          },
          {
            from: ['fullName'],
            uppercase: true,
            font: "500 142px '1FTV VIP Glasvia'",
            color: '#f7c978',
          },
        ],
      },
      position: {
        from: ['position'],
        x: 1235,
        y: 770,
        font: "200 48px 'Be Vietnam Pro Local'",
        color: '#ffffff',
        align: 'center',
        uppercase: true,
        maxWidth: 1540,
      },
      company: {
        from: ['company'],
        x: 1235,
        y: 870,
        uppercase: true,
        font: "400 71px 'Be Vietnam Pro Local'",
        color: '#f7c978',
        align: 'center',
        maxWidth: 1540,
      },
      text: {
        label: '*Trang Phục: Lịch sự (tone Trắng, Đen, Kem)',
        x: 175,
        y: 3540,
        font: "400 42px 'Be Vietnam Pro Local'",
        color: '#ffffff',
        align: 'left',
        maxWidth: 2000,
      },
    },
  },
  // Sự kiện Test — nền tím theo theme dự án, form giống hệt "Gặp Mặt Đại
  // Lý". Có thêm mã QR ĐỘNG ở dưới, value = token duy nhất sinh khi submit
  // (xem src/utils/token.js + App.jsx) — dùng để check-in.
  test: {
    label: 'Test',
    bgImage: '/assets/test-event.png',
    canvasSize: { width: 2480, height: 3652 },
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
            placeholder: 'Nguyễn Văn A',
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
            placeholder: 'VD: Giám đốc Kinh doanh',
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
            placeholder: 'VD: Nam Mekong Group',
            required: true,
          },
        ],
      },
    ],
    fields: {
      fullName: {
        type: 'multi-text',
        x: 1240,
        y: 1850,
        align: 'center',
        gap: 30,
        segments: [
          {
            from: ['title'],
            font: "400 78px '1FTV VIP Glasvia'",
            color: '#f7c978',
          },
          {
            from: ['fullName'],
            uppercase: true,
            font: "500 128px '1FTV VIP Glasvia'",
            color: '#f7c978',
          },
        ],
      },
      position: {
        from: ['position'],
        x: 1240,
        y: 1960,
        font: "200 46px 'Be Vietnam Pro Local'",
        color: '#ffffff',
        align: 'center',
        uppercase: true,
        maxWidth: 1900,
      },
      company: {
        from: ['company'],
        x: 1240,
        y: 2080,
        uppercase: true,
        font: "400 64px 'Be Vietnam Pro Local'",
        color: '#f7c978',
        align: 'center',
        maxWidth: 1900,
      },
      qr: {
        type: 'qr',
        valueKey: 'token',
        x: 1240,
        y: 2540,
        align: 'center',
        size: 440,
      },
    },
  },
  // Thư cảm ơn — form CHỈ cần tên Đại lý (không danh xưng/chức danh).
  // 'thu-camon-08072026': {
  //   label: 'Thư Cảm Ơn (Sự Kiện Sa Bàn)',
  //   bgImage: '/assets/thu-cam-on.jpg',
  //   canvasSize: { width: 2480, height: 3720 },
  //   form: [
  //     {
  //       label: 'Tên Đại lý',
  //       inputs: [
  //         {
  //           name: 'company',
  //           type: 'text',
  //           placeholder: 'VD: Nam Mekong Group',
  //           required: true,
  //         },
  //       ],
  //     },
  //   ],
  //   fields: {
  //     // TODO: chỉnh x, y, font, color, maxWidth cho khớp thiết kế thư cảm ơn.
  //     // Hiện đặt tạm căn giữa theo chiều ngang của canvas 2480px (x = 1240).
  //     company: {
  //       from: ['company'],
  //       // uppercase: true,
  //       x: 995,
  //       y: 788,
  //       font: "300 56px 'Be Vietnam Pro Local'",
  //       color: '#ffffff',
  //       align: 'left',
  //       maxWidth: 2000,
  //     },
  //   },
  // },
};
