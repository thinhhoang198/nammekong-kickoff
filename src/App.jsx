import { useState } from 'react';
import InvitationForm from './components/InvitationForm';
import CardModal from './components/CardModal';
import { EVENTS } from './data/events';
import { renderInvitation } from './utils/canvas';
import { saveLead } from './utils/api';
import { generateToken, generateFallbackLuckyNumber } from './utils/token';

export default function App() {
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async (form, onFinish) => {
    setLoading(true);
    setError(null);

    try {
      const event = EVENTS[form.eventKey];

      // Token duy nhất cho người này — vừa làm value cho mã QR trên
      // thiệp (field type "qr" trong events.js), vừa lưu vào Sheet để
      // đối soát lúc quét check-in.
      const formWithToken = { ...form, token: generateToken() };

      // 1. Lưu lead vào Google Sheets TRƯỚC khi vẽ ảnh (khác thứ tự cũ):
      //    Lucky Number (4 số, dùng cho vòng quay may mắn) phải DUY NHẤT
      //    giữa mọi khách — chỉ Apps Script mới thấy được toàn bộ danh sách
      //    đã cấp nên phải nhờ server cấp số rồi mới vẽ được lên thiệp.
      //    Nếu đang "thay thế" 1 bản ghi trùng (action update), server sẽ tự
      //    giữ nguyên Lucky Number cũ của người đó thay vì cấp số mới.
      let luckyNumber;
      try {
        // Gửi kèm eventLabel để backend đặt tên tab sheet cho dễ đọc.
        const result = await saveLead({ ...formWithToken, eventLabel: event.label });
        luckyNumber = result.luckyNumber;
      } catch (e) {
        // Backend chưa cấu hình / lỗi mạng -> vẫn cho tạo thiệp xem trước,
        // chỉ là Lucky Number lúc này KHÔNG được đảm bảo không trùng.
        console.warn('Chưa lưu được lead / cấp Lucky Number:', e.message);
      }
      if (!luckyNumber) luckyNumber = generateFallbackLuckyNumber();

      // 2. Vẽ ảnh ở client (luôn chạy, kể cả không có backend).
      //    luckyLabel dựng sẵn chuỗi hiển thị để field trong events.js chỉ
      //    cần in thẳng ra, không phải ghép prefix tĩnh + giá trị động.
      const dataUrl = await renderInvitation(event, {
        ...formWithToken,
        luckyNumber,
        luckyLabel: `Lucky Number: ${luckyNumber}`,
      });
      setImageUrl(dataUrl);
    } catch (err) {
      setError(
        err.message ||
          'Không tạo được thiệp. Kiểm tra lại ảnh nền trong /public/assets.',
      );
      setImageUrl(null);
    } finally {
      setLoading(false);
      if (onFinish) {
        onFinish();
      }
    }
  };

  return (
    <div className="app">
      <img
        src="/assets/logo.png"
        className="logo"
        alt="Logo Nam Mekong Grand Plaza"
      />
      <header className="masthead">
        <h1>
          <em>Tạo thiệp online</em>
        </h1>
        <p>
          Nhập thông tin của bạn để nhận thiệp cá nhân hóa cho sự kiện Nam
          Mekong Grand Plaza.
        </p>
      </header>

      <div className="layout">
        <div className="form-panel">
          <div className="form-panel-title">Thông tin Thiệp Online</div>
          <InvitationForm onGenerate={handleGenerate} loading={loading} />
          {error && <div className="notice notice-error">{error}</div>}
        </div>
      </div>

      {imageUrl && (
        <CardModal imageUrl={imageUrl} onReset={() => setImageUrl(null)} />
      )}
    </div>
  );
}
