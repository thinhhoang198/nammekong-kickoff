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

      // Token & Lucky Number PHẢI khoá vĩnh viễn với đúng 1 khách: một khi đã
      // cấp lần đầu, sửa thông tin sau này (action "update", khi tra trùng
      // phát hiện khách đã có sẵn) không được đổi 2 giá trị này nữa. Chỉ
      // Apps Script mới thấy được sheet thật (và admin có thể đã sửa tay) nên
      // server luôn là nơi quyết định giá trị cuối cùng — client chỉ gửi 1
      // token ỨNG VIÊN (dùng khi đây thực sự là khách mới), rồi PHẢI dùng lại
      // giá trị server trả về để vẽ thiệp, không tự ý dùng token vừa sinh.
      const candidateToken = generateToken();

      let token = candidateToken;
      let luckyNumber;
      try {
        // Gửi kèm eventLabel để backend đặt tên tab sheet cho dễ đọc.
        const result = await saveLead({
          ...form,
          token: candidateToken,
          eventLabel: event.label,
        });
        if (result.token) token = result.token;
        luckyNumber = result.luckyNumber;
      } catch (e) {
        // Backend chưa cấu hình / lỗi mạng -> vẫn cho tạo thiệp xem trước
        // bằng token ứng viên + Lucky Number tạm, nhưng cả hai lúc này KHÔNG
        // được đảm bảo khoá đúng khách cũ / không trùng người khác.
        console.warn('Chưa lưu được lead / cấp Token-Lucky Number:', e.message);
      }
      if (!luckyNumber) luckyNumber = generateFallbackLuckyNumber();

      // Vẽ ảnh ở client (luôn chạy, kể cả không có backend).
      // luckyLabel dựng sẵn chuỗi hiển thị để field trong events.js chỉ cần
      // in thẳng ra, không phải ghép prefix tĩnh + giá trị động.
      const dataUrl = await renderInvitation(event, {
        ...form,
        token,
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
