import { useCallback, useEffect, useRef, useState } from 'react';

// Máy quét QR vật lý (đầu đọc cầm tay/súng bắn mã) hoạt động như bàn phím:
// nó "gõ" token đọc được vào ô input đang focus rồi tự gửi phím Enter.
// Component này chỉ cần giữ 1 input luôn focus, bắt Enter, rồi gọi
// /api/checkin — không cần quyền camera, không cần thư viện quét mã.

function formatTime(date) {
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function checkinToken(token) {
  const res = await fetch('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.ok === false) {
    return {
      status: 'error',
      message: data.error || `Lỗi máy chủ (${res.status})`,
    };
  }
  return {
    status: data.alreadyConfirmed ? 'warn' : 'ok',
    guest: data.guest,
  };
}

export default function CheckinApp() {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(null);
  const [log, setLog] = useState([]);
  const inputRef = useRef(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const submitToken = useCallback(
    async (rawToken) => {
      const token = rawToken.trim();
      if (!token || loading) return;

      setLoading(true);
      const result = await checkinToken(token).catch(() => ({
        status: 'error',
        message: 'Không kết nối được server',
      }));

      const entry = { ...result, token, time: new Date() };
      setCurrent(entry);
      setLog((prev) => [entry, ...prev].slice(0, 30));
      setLoading(false);
      setValue('');
      focusInput();
    },
    [loading, focusInput],
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitToken(value);
    }
  };

  return (
    <div className="app checkin-page">
      <header className="masthead">
        <div className="eyebrow">Check-in sự kiện</div>
        <h1>
          Quét <em>QR</em> check-in
        </h1>
        <p>Đưa máy quét vào ô bên dưới rồi quét mã trên thiệp — hệ thống tự xác nhận.</p>
      </header>

      <div className="form-panel">
        <div className="form-panel-title">Ô nhận dữ liệu từ máy quét</div>

        <div className="field">
          <label htmlFor="scan-input">Token (tự động điền khi quét)</label>
          <input
            id="scan-input"
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={focusInput}
            placeholder="Sẵn sàng quét..."
            autoComplete="off"
            disabled={loading}
          />
        </div>

        {loading && (
          <div className="notice">
            <span className="spinner checkin-spinner" /> Đang xác nhận...
          </div>
        )}

        {!loading && current && (
          <div className={`checkin-result checkin-result-${current.status}`}>
            {current.status === 'error' ? (
              <p>
                ❌ {current.message}{' '}
                <span className="checkin-token">({current.token})</span>
              </p>
            ) : (
              <>
                <p className="checkin-result-name">
                  {current.status === 'warn'
                    ? '⚠️ Đã check-in trước đó — '
                    : '✅ Check-in thành công — '}
                  {current.guest.title} {current.guest.fullName}
                </p>
                <p className="checkin-result-meta">
                  {[current.guest.position, current.guest.company]
                    .filter(Boolean)
                    .join(' · ')}
                  {current.guest.eventKey ? ` · ${current.guest.eventKey}` : ''}
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="form-panel checkin-log-panel">
        <div className="form-panel-title">Lịch sử quét ({log.length})</div>
        {log.length === 0 ? (
          <p className="checkin-log-empty">Chưa có lượt quét nào.</p>
        ) : (
          <ul className="checkin-log">
            {log.map((entry, i) => (
              <li
                key={i}
                className={`checkin-log-item checkin-log-item-${entry.status}`}
              >
                <span className="checkin-log-time">{formatTime(entry.time)}</span>
                <span className="checkin-log-text">
                  {entry.status === 'error'
                    ? `❌ ${entry.message} (${entry.token})`
                    : `${entry.status === 'warn' ? '⚠️' : '✅'} ${entry.guest.title} ${entry.guest.fullName}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
