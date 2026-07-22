import { useState } from 'react';

const FILE_NAME = 'nmk-digital-card.png';

/** Thiết bị iOS (iPhone/iPad/iPod) — WebView iOS (WKWebView) không hỗ trợ <a download> */
function isIos() {
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(ua);
}

/** Trình duyệt in-app: Zalo, Facebook, Messenger, Instagram, Line, WeChat… */
function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /Zalo|FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|MicroMessenger/i.test(
    ua,
  );
}

/**
 * Chỉ iOS + in-app browser mới cần cách "nhấn giữ ảnh để Lưu ảnh".
 * Android in-app (kể cả Zalo) và trình duyệt thường đều tải trực tiếp được
 * bằng <a download> — nên KHÔNG bung modal ở các trường hợp đó.
 */
function needLongPressToSave() {
  return isIos() && isInAppBrowser();
}

export default function PreviewPanel({ imageUrl, error, onReset }) {
  // Modal "nhấn giữ để lưu" cho in-app browser (giống cách bigfour.vn làm)
  const [showSaveModal, setShowSaveModal] = useState(false);

  const download = () => {
    if (!imageUrl) return;

    // iOS in-app (Zalo/Messenger… trên iPhone): WKWebView chặn <a download>,
    // hiện ảnh trong modal + hướng dẫn nhấn giữ chọn "Lưu ảnh" → vào thư viện.
    if (needLongPressToSave()) {
      setShowSaveModal(true);
      return;
    }

    // Android in-app + trình duyệt thường (Chrome/Safari…): tải trực tiếp.
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="preview">
      <div className="preview-frame">
        {imageUrl ? (
          <img src={imageUrl} alt="Thiệp đã tạo" />
        ) : (
          <div className="preview-empty">
            <div className="mark">✦</div>
            <p>Điền thông tin bên cạnh để xem trước thiệp của bạn.</p>
          </div>
        )}
      </div>

      {imageUrl && needLongPressToSave() && (
        <div className="notice notice-warning">
          Hãy mở bằng Safari hoặc Chrome để có trải nghiệm tốt hơn.
        </div>
      )}

      {imageUrl && (
        <div
          className="preview-actions"
          style={{ display: 'flex', gap: 8, marginTop: 16 }}
        >
          <button className="btn btn-primary" onClick={download}>
            Tải ảnh về
          </button>
          <button className="btn btn-ghost" onClick={onReset}>
            Tạo lại
          </button>
        </div>
      )}

      {error && <div className="notice notice-error">{error}</div>}

      {/* Modal lưu ảnh cho trình duyệt Zalo/Facebook (nhấn giữ ảnh để lưu) */}
      {showSaveModal && (
        <div className="save-modal" onClick={() => setShowSaveModal(false)}>
          <div
            className="save-modal-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="save-modal-hint">
              Nhấn <strong>giữ vào ảnh</strong> bên dưới rồi chọn{' '}
              <strong>“Lưu ảnh”</strong> để tải về máy.
            </p>
            <img
              className="save-modal-img"
              src={imageUrl}
              alt="Thiệp — nhấn giữ để lưu"
            />
            <button
              className="btn btn-ghost"
              onClick={() => setShowSaveModal(false)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
