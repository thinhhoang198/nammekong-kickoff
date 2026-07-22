import { useState, useMemo } from 'react';
import { EVENTS } from '../data/events';
import { checkDuplicateLead } from '../utils/api';
import DuplicateModal from './DuplicateModal';

// Lấy tất cả input (phẳng) của 1 event từ mảng form theo hàng.
function flattenInputs(event) {
  if (!event) return [];
  return event.form.flatMap((row) => row.inputs);
}

// Trường dùng để tra trùng: ưu tiên "fullName" (tên người); event nào
// không có tên người (vd Thư cảm ơn) thì tra theo "company" (tên đại lý).
function getIdentityField(event) {
  const names = flattenInputs(event).map((i) => i.name);
  if (names.includes('fullName')) return 'fullName';
  if (names.includes('company')) return 'company';
  return null;
}

export default function InvitationForm({ onGenerate, loading }) {
  const [eventKey, setEventKey] = useState('');
  // values: dữ liệu các ô nhập của event ĐANG chọn (không gồm eventKey).
  const [values, setValues] = useState({});
  const [checking, setChecking] = useState(false);
  // duplicate: { matches } khi phát hiện trùng, chờ user chọn 1 trong 3 option.
  const [duplicate, setDuplicate] = useState(null);

  const event = EVENTS[eventKey];

  // Khi đổi sự kiện: xoá sạch dữ liệu cũ vì form mỗi event khác nhau.
  const changeEvent = (e) => {
    setEventKey(e.target.value);
    setValues({});
  };

  const update = (e) =>
    setValues((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // Hợp lệ khi đã chọn event và mọi input required đều có giá trị.
  const valid = useMemo(() => {
    if (!event) return false;
    return flattenInputs(event)
      .filter((input) => input.required)
      .every((input) => (values[input.name] || '').trim());
  }, [event, values]);

  const doGenerate = (formPayload) => {
    onGenerate(formPayload, () => {
      setEventKey('');
      setValues({});
    });
  };

  const submit = async () => {
    if (!valid || checking) return;
    const formPayload = { eventKey, ...values };

    const identityField = getIdentityField(event);
    const matchValue = identityField ? (values[identityField] || '').trim() : '';

    // Event nào không có field định danh (hiếm) thì bỏ qua bước tra trùng.
    if (!identityField || !matchValue) {
      doGenerate(formPayload);
      return;
    }

    setChecking(true);
    try {
      const { matches } = await checkDuplicateLead({
        eventKey,
        eventLabel: event.label,
        matchField: identityField,
        matchValue,
      });
      if (matches && matches.length > 0) {
        setDuplicate({ matches, formPayload });
      } else {
        doGenerate(formPayload);
      }
    } catch (e) {
      // Tra trùng lỗi (vd backend chưa cấu hình) -> không chặn tạo thiệp.
      console.warn('Không kiểm tra được trùng:', e.message);
      doGenerate(formPayload);
    } finally {
      setChecking(false);
    }
  };

  const replaceDuplicate = (matchRecord) => {
    const formPayload = { ...duplicate.formPayload, action: 'update', matchRecord };
    setDuplicate(null);
    doGenerate(formPayload);
  };

  const createNewDespiteDuplicate = () => {
    const formPayload = { ...duplicate.formPayload, action: 'create' };
    setDuplicate(null);
    doGenerate(formPayload);
  };

  return (
    <div>
      <div className="field">
        <label>Sự kiện tham gia</label>
        <select value={eventKey} onChange={changeEvent}>
          <option value="">— Chọn sự kiện —</option>
          {Object.entries(EVENTS).map(([key, ev]) => (
            <option key={key} value={key}>
              {ev.label}
            </option>
          ))}
        </select>
      </div>

      {/* Form động: render theo schema của event đang chọn */}
      {event &&
        event.form.map((row, i) => (
          <div className="field" key={i}>
            <label>{row.label}</label>
            <div className={row.inputs.length > 1 ? 'row-2' : undefined}>
              {row.inputs.map((input) =>
                input.type === 'select' ? (
                  <select
                    key={input.name}
                    name={input.name}
                    value={values[input.name] || ''}
                    onChange={update}
                  >
                    <option value="">{input.placeholder || '— Chọn —'}</option>
                    {(input.options || []).map((opt) => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    key={input.name}
                    name={input.name}
                    value={values[input.name] || ''}
                    onChange={update}
                    placeholder={input.placeholder}
                  />
                ),
              )}
            </div>
          </div>
        ))}

      <button
        className="btn btn-primary"
        onClick={submit}
        disabled={!valid || loading || checking}
      >
        {loading || checking ? <span className="spinner" /> : 'Tạo thiệp mời'}
      </button>

      {duplicate && (
        <DuplicateModal
          matches={duplicate.matches}
          onReplace={replaceDuplicate}
          onCreateNew={createNewDespiteDuplicate}
          onCancel={() => setDuplicate(null)}
        />
      )}
    </div>
  );
}
