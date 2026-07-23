import { useState } from 'react';
import { createPortal } from 'react-dom';

/** Ghép các phần khác rỗng của 1 bản ghi trùng thành 1 dòng mô tả dễ đọc. */
function describeMatch(m) {
  const namePart = [m.title, m.fullName].filter(Boolean).join(' ').trim();
  const phonePart = m.phone ? `SĐT: ${m.phone}` : null;
  return [namePart, phonePart, m.position, m.company].filter(Boolean).join(' — ');
}

export default function DuplicateModal({ matches, onReplace, onCreateNew, onCancel }) {
  const [selected, setSelected] = useState(null);

  // Render ra document.body (portal): .form-panel có backdrop-filter, mà theo
  // spec CSS thì backdrop-filter/filter tạo containing block mới cho phần tử
  // position:fixed bên trong nó -> nếu render tại chỗ, modal sẽ bị "nhốt"
  // trong khung form thay vì phủ kín màn hình.
  return createPortal(
    <div className="save-modal" onClick={onCancel}>
      <div className="duplicate-modal-inner" onClick={(e) => e.stopPropagation()}>
        <h3 className="duplicate-modal-title">Tên này đã có trong hệ thống</h3>
        <p className="duplicate-modal-hint">
          Chọn 1 bản ghi bên dưới để thay thế thông tin, hoặc tạo mới hoàn toàn nếu
          đây là người/đại lý khác.
        </p>

        <div className="duplicate-list">
          {matches.map((m, i) => (
            <label className="duplicate-item" key={i}>
              <input
                type="checkbox"
                checked={selected === i}
                onChange={() => setSelected(selected === i ? null : i)}
              />
              <span>{describeMatch(m)}</span>
            </label>
          ))}
        </div>

        <div className="duplicate-btn-row">
          <button
            className="btn btn-primary"
            disabled={selected === null}
            onClick={() => onReplace(matches[selected])}
          >
            Thay thế
          </button>
          <button className="btn btn-ghost" onClick={onCreateNew}>
            Tạo mới
          </button>
          <button className="btn btn-ghost" onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
