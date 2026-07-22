// ============================================================
// LÕI KỸ THUẬT: vẽ thiệp lên canvas.
// Trả về Promise<dataURL> (ảnh PNG base64) để preview/download.
//
// Xử lý 2 vấn đề hay gặp:
//  1. Font tiếng Việt: phải đợi font load XONG trước khi vẽ,
//     nếu không canvas vẽ bằng font fallback (sai font, lỗi dấu).
//  2. Tên dài: tự động wrap xuống dòng nếu vượt maxWidth.
// ============================================================

import QRCode from 'qrcode';

// Chuỗi mẫu phủ đủ dấu tiếng Việt (bao gồm cả nguyên âm có dấu tổ hợp
// â/ê/ô + thanh điệu) — ép trình duyệt tải luôn phần unicode-range
// "vietnamese" của font, không chỉ phần "latin".
const VIETNAMESE_SAMPLE =
  "aăâbcdđeêghiklmnoôơpqrstuưvxyAĂÂBCDĐEÊGHIKLMNOÔƠPQRSTUƯVXY" +
  "áàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ";

/**
 * Đợi font web load xong (quan trọng cho tiếng Việt).
 * Chủ động load từng font dùng trong event vì canvas không tự
 * kích hoạt tải font — chỉ CSS/DOM mới làm trình duyệt tải font.
 *
 * Quan trọng: phải truyền text mẫu vào document.fonts.load(font, text).
 * Nếu gọi không kèm text, trình duyệt chỉ test bằng chuỗi mặc định
 * "BESbswy" (không dấu) — với font bị tách theo unicode-range (vd:
 * 'Be Vietnam Pro Local' tách latin/vietnamese trong styles.css), file
 * "vietnamese" sẽ KHÔNG được tải trước, khiến lần vẽ canvas đầu tiên
 * dùng font fallback (sai dấu). Phải bấm lần 2 mới đúng vì lúc đó
 * trình duyệt đã tải xong file font từ lần fillText() trước đó.
 */
async function ensureFontsReady(event, data) {
  if (!document.fonts) return;

  const fontShorthands = new Set();
  const texts = [];
  for (const field of Object.values(event.fields)) {
    if (field.font) fontShorthands.add(field.font);
    if (field.segments) {
      for (const segment of field.segments) {
        if (segment.font) fontShorthands.add(segment.font);
        texts.push(buildText(segment, data));
      }
    } else {
      texts.push(buildText(field, data));
    }
  }

  const actualText = texts.filter(Boolean).join(" ");
  const sampleText = `${actualText} ${VIETNAMESE_SAMPLE}`;

  await Promise.all(
    [...fontShorthands].map((font) => document.fonts.load(font, sampleText)),
  );

  await document.fonts.ready;
}

/** Build chuỗi text cho 1 field từ data người dùng nhập */
function buildText(field, data) {
  let text = "";
  if (field.static) text = field.static;
  else if (field.label) text = field.label;
  else if (field.from) {
    text = field.from
      .map((key) => data[key])
      .filter(Boolean)
      .join(field.separator ?? " ")
      .trim();
  }
  return field.uppercase ? text.toUpperCase() : text;
}

/** Vẽ text có letterSpacing (canvas không hỗ trợ sẵn tốt) */
function drawTextWithSpacing(ctx, text, x, y, spacing, align) {
  if (!spacing) {
    ctx.fillText(text, x, y);
    return;
  }
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let cursor = align === "center" ? x - total / 2 : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cursor, y);
    cursor += widths[i];
  });
  ctx.textAlign = prevAlign;
}

/** Wrap text theo maxWidth, trả mảng dòng */
function wrapLines(ctx, text, maxWidth) {
  if (!maxWidth) return [text];
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Vẽ thiệp.
 * @param {object} event  - config từ events.js
 * @param {object} data   - { title, fullName, position, ... }
 * @returns {Promise<string>} dataURL PNG
 *
 * Field types đặc biệt hỗ trợ: gradient-overlay, line, image (chèn ảnh
 * tĩnh có sẵn, vd: QR đã dựng sẵn trong /public/assets).
 */
export async function renderInvitation(event, data) {
  await ensureFontsReady(event, data);

  const canvas = document.createElement("canvas");
  canvas.width = event.canvasSize.width;
  canvas.height = event.canvasSize.height;
  const ctx = canvas.getContext("2d");

  // 1. Vẽ ảnh nền
  const bg = await loadImage(event.bgImage);
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);

  // 2. Vẽ từng field (text + decorator)
  for (const field of Object.values(event.fields)) {
    // Gradient overlay — tăng tương phản vùng text
    if (field.type === "gradient-overlay") {
      const grad = ctx.createLinearGradient(0, field.y, 0, field.y + field.height);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, field.color || "rgba(0,0,0,0.85)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, field.y, canvas.width, field.height);
      continue;
    }

    // Đường kẻ trang trí ngang
    if (field.type === "line") {
      ctx.save();
      ctx.strokeStyle = field.color || "#ffffff";
      ctx.lineWidth = field.lineWidth || 1;
      ctx.globalAlpha = field.opacity !== undefined ? field.opacity : 1;
      ctx.beginPath();
      ctx.moveTo(field.x1 !== undefined ? field.x1 : 0, field.y);
      ctx.lineTo(field.x2 !== undefined ? field.x2 : canvas.width, field.y);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    // Ảnh tĩnh (vd: QR đã dựng sẵn) — neo theo mép ảnh
    if (field.type === "image") {
      const size = field.size || 240;
      const margin = field.margin ?? 60;
      const marginX = field.marginX ?? margin;
      const marginY = field.marginY ?? margin;
      const anchor = field.anchor || "bottom-right";
      const img = await loadImage(field.src);
      const x =
        field.x !== undefined
          ? field.x
          : anchor.endsWith("left")
            ? marginX
            : canvas.width - marginX - size;
      const y =
        field.y !== undefined
          ? field.y
          : anchor.startsWith("top")
            ? marginY
            : canvas.height - marginY - size;
      ctx.drawImage(img, x, y, size, size);
      continue;
    }

    // Mã QR động — value lấy từ data[field.valueKey] (mặc định "token"),
    // sinh mới mỗi lần vẽ (khác với type "image" là ảnh tĩnh có sẵn).
    // Vẽ ở độ phân giải cao (qrPixelSize) rồi scale xuống size hiển thị
    // để nét khi in/zoom.
    if (field.type === "qr") {
      const value = data[field.valueKey || "token"];
      if (!value) continue;

      const size = field.size || 320;
      const qrDataUrl = await QRCode.toDataURL(String(value), {
        width: field.qrPixelSize || size * 3,
        margin: field.qrMargin ?? 1,
        errorCorrectionLevel: field.errorCorrectionLevel || "M",
        color: {
          dark: field.darkColor || "#1a0535",
          light: field.lightColor || "#ffffff",
        },
      });
      const img = await loadImage(qrDataUrl);

      // x/y đặt theo tâm khi align/valign = "center", còn lại là mép trên-trái.
      const x =
        field.x === undefined
          ? (canvas.width - size) / 2
          : field.align === "center"
            ? field.x - size / 2
            : field.x;
      const y =
        field.y === undefined
          ? (canvas.height - size) / 2
          : field.valign === "center"
            ? field.y - size / 2
            : field.y;

      ctx.drawImage(img, x, y, size, size);
      continue;
    }

    // Nhiều đoạn text cỡ chữ/font khác nhau nối trên CÙNG 1 dòng, canh theo
    // baseline chung (vd: "Ông  NGUYỄN VĂN A" — danh xưng nhỏ, tên to).
    if (field.type === "multi-text") {
      const segments = field.segments
        .map((segment) => ({ segment, text: buildText(segment, data) }))
        .filter((s) => s.text);
      if (!segments.length) continue;

      const gap = field.gap ?? 0;
      const widths = segments.map(({ segment, text }) => {
        ctx.font = segment.font;
        return ctx.measureText(text).width;
      });
      const total = widths.reduce((a, b) => a + b, 0) + gap * (segments.length - 1);

      const align = field.align || "left";
      let cursor =
        align === "center" ? field.x - total / 2 : align === "right" ? field.x - total : field.x;

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      segments.forEach(({ segment, text }, i) => {
        ctx.font = segment.font;
        ctx.fillStyle = segment.color;
        ctx.fillText(text, cursor, field.y);
        cursor += widths[i] + gap;
      });
      continue;
    }

    const text = buildText(field, data);
    if (!text) continue;

    ctx.font = field.font;
    ctx.fillStyle = field.color;
    ctx.textAlign = field.align || "left";
    ctx.textBaseline = "alphabetic";

    const lines = wrapLines(ctx, text, field.maxWidth);
    const lineHeight = parseInt(field.font.match(/(\d+)px/)?.[1] || "40", 10) * 1.2;

    lines.forEach((line, i) => {
      const y = field.y + i * lineHeight;
      if (field.letterSpacing) {
        drawTextWithSpacing(ctx, line, field.x, y, field.letterSpacing, field.align);
      } else {
        ctx.fillText(line, field.x, y);
      }
    });
  }

  return canvas.toDataURL("image/png");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // cần khi ảnh nền nằm trên CDN khác
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Không tải được ảnh nền: ${src}`));
    img.src = src;
  });
}

/** Đổi dataURL PNG sang Blob để upload lên server/Cloudinary */
export function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
