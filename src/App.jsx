import { useState } from 'react';
import InvitationForm from './components/InvitationForm';
import PreviewPanel from './components/PreviewPanel';
import { EVENTS } from './data/events';
import { renderInvitation } from './utils/canvas';
import { saveLead } from './utils/api';
import { generateToken } from './utils/token';

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

      // 1. Vẽ ảnh ở client (luôn chạy, kể cả không có backend)
      const dataUrl = await renderInvitation(event, formWithToken);
      setImageUrl(dataUrl);

      // 2. Lưu lead vào Google Sheets (qua /api/lead).
      //    Nếu backend chưa cấu hình -> bỏ qua, ảnh vẫn tải về được.
      try {
        // Gửi kèm eventLabel để backend đặt tên tab sheet cho dễ đọc.
        await saveLead({ ...formWithToken, eventLabel: event.label });
      } catch (e) {
        console.warn('Chưa lưu được lead:', e.message);
      }
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
        <span className="eyebrow">Nam Mekong Grand Plaza · Digital Card</span>
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
        </div>
        <PreviewPanel
          imageUrl={imageUrl}
          error={error}
          onReset={() => setImageUrl(null)}
        />
      </div>
    </div>
  );
}
