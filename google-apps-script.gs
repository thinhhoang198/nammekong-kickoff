/**
 * Apps Script webhook nhận lead từ app và ghi vào Google Sheet.
 *
 * MỖI SỰ KIỆN = MỘT SHEET (TAB) RIÊNG.
 *   - Khi có lead của một event mới, script tự tạo 1 tab mới
 *     (đặt tên theo tên sự kiện), kẻ sẵn dòng tiêu đề rồi mới ghi.
 *   - Event cũ đã có tab thì ghi tiếp vào đúng tab đó.
 *   => Không cần sửa Apps Script mỗi khi thêm event trong code app.
 *
 * CÁCH DÙNG:
 *  1. Mở Sheet -> Extensions -> Apps Script
 *  2. Dán toàn bộ file này, Save
 *  3. Deploy -> New deployment -> Web app
 *       Execute as: Me
 *       Who has access: Anyone
 *  4. Copy Web app URL -> dán vào biến GOOGLE_SHEET_WEBHOOK trên Vercel
 *
 * Mỗi lần sửa file này: Deploy -> Manage deployments -> Edit
 *   -> Version: New version (nếu không, deploy cũ vẫn chạy code cũ).
 */

// Dòng tiêu đề dùng chung cho MỌI tab sự kiện.
var HEADERS = ['Thời gian', 'Danh xưng', 'Họ tên', 'Chức danh', 'Tên công ty', 'Sự kiện', 'Token', 'Trạng thái'];

// Cột 1-indexed dùng để tra cứu khi kiểm tra trùng.
var COL_TITLE = 2;
var COL_FULLNAME = 3;
var COL_POSITION = 4;
var COL_COMPANY = 5;
// Cột 7 = Token (mã QR check-in, xem src/utils/token.js) — chỉ ghi, không
// dùng để tra trùng.
// Cột 8 = Trạng thái check-in — mặc định STATUS_PENDING khi tạo thiệp,
// chuyển sang STATUS_CONFIRMED khi đội quét QR gọi action "checkin" với
// đúng token (xem findAndConfirmToken bên dưới).
var COL_STATUS = 8;

var STATUS_PENDING = 'Chờ xác nhận';
var STATUS_CONFIRMED = 'Đã xác nhận';

// Mở URL bằng trình duyệt -> thấy dòng này = script sống.
function doGet() {
  return ContentService.createTextOutput("Lead webhook OK");
}

// Nhận POST từ Vercel /api/lead (tạo/tra trùng lead) hoặc /api/checkin
// (đội quét QR xác nhận check-in).
// data.action: 'check' (tra trùng, không ghi) | 'update' (ghi đè dòng đã
// chọn) | 'checkin' (quét QR, đổi Trạng thái -> Đã xác nhận) | mặc định =
// tạo dòng mới.
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Check-in quét QR: tìm theo token trên TẤT CẢ các tab (không biết
    // trước token thuộc sự kiện nào), không cần eventKey/eventLabel.
    if (data.action === 'checkin') {
      var result = findAndConfirmToken(ss, data.token);
      return jsonOutput(Object.assign({ ok: true }, result));
    }

    var sheetName = sanitizeSheetName(data.eventLabel || data.eventKey || 'Khác');

    if (data.action === 'check') {
      return jsonOutput({
        ok: true,
        matches: findMatches(ss, sheetName, data.matchField, data.matchValue),
      });
    }

    var sheet = getOrCreateEventSheet(ss, sheetName);
    var row = [
      data.time || new Date(),
      data.title || "",
      data.fullName || "",
      data.position || "",
      data.company || "",
      data.eventKey || "",
      data.token || "",
      STATUS_PENDING,
    ];

    // Thay thế: tìm đúng dòng khớp với bản ghi cũ (matchRecord) rồi ghi đè.
    // Nếu không tìm thấy nữa (bị xoá/sửa giữa lúc check và submit) -> vẫn
    // thêm dòng mới để không mất dữ liệu người dùng vừa nhập.
    if (data.action === 'update' && data.matchRecord) {
      var rowIndex = findRowIndex(sheet, data.matchRecord);
      if (rowIndex) {
        sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
        return jsonOutput({ ok: true, sheet: sheetName, replaced: true });
      }
    }

    sheet.appendRow(row);
    return jsonOutput({ ok: true, sheet: sheetName, replaced: false });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Tìm mọi dòng trong tab sự kiện có matchField (fullName|company) trùng
// matchValue (không phân biệt hoa/thường, khoảng trắng đầu/cuối).
function findMatches(ss, sheetName, matchField, matchValue) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var col = matchField === 'company' ? COL_COMPANY : COL_FULLNAME;
  var target = normalize(matchValue);
  if (!target) return [];

  var values = sheet.getDataRange().getValues();
  var matches = [];
  for (var i = 1; i < values.length; i++) { // bỏ dòng tiêu đề
    var r = values[i];
    if (normalize(r[col - 1]) === target) {
      matches.push({
        title: r[COL_TITLE - 1],
        fullName: r[COL_FULLNAME - 1],
        position: r[COL_POSITION - 1],
        company: r[COL_COMPANY - 1],
      });
    }
  }
  return matches;
}

// Tìm dòng khớp đúng cả 4 cột với bản ghi cũ user đã chọn để thay thế.
function findRowIndex(sheet, matchRecord) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (
      normalize(r[COL_TITLE - 1]) === normalize(matchRecord.title) &&
      normalize(r[COL_FULLNAME - 1]) === normalize(matchRecord.fullName) &&
      normalize(r[COL_POSITION - 1]) === normalize(matchRecord.position) &&
      normalize(r[COL_COMPANY - 1]) === normalize(matchRecord.company)
    ) {
      return i + 1; // Sheets 1-indexed
    }
  }
  return null;
}

// Quét mọi tab tìm dòng có cột "Token" khớp giá trị token (không phân biệt
// hoa/thường) -> đổi cột "Trạng thái" sang STATUS_CONFIRMED rồi trả về
// thông tin khách để app quét QR hiển thị xác nhận trên màn hình.
// Tra theo TÊN cột (không theo số cột cố định) để không vỡ nếu tab cũ
// (tạo trước khi có cột Token/Trạng thái) có ít cột hơn.
function findAndConfirmToken(ss, token) {
  var target = normalize(token);
  if (!target) return { found: false, error: 'Thiếu token' };

  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) continue; // chỉ có (hoặc chưa có) dòng tiêu đề

    var header = values[0];
    var tokenCol = header.indexOf('Token');
    if (tokenCol === -1) continue; // tab này không có cột Token (vd Sheet1 mặc định)
    var statusCol = header.indexOf('Trạng thái');

    for (var i = 1; i < values.length; i++) {
      if (normalize(values[i][tokenCol]) !== target) continue;

      var alreadyConfirmed = statusCol !== -1 && values[i][statusCol] === STATUS_CONFIRMED;
      if (statusCol !== -1) {
        sheet.getRange(i + 1, statusCol + 1).setValue(STATUS_CONFIRMED);
      }

      var col = function (name) {
        var idx = header.indexOf(name);
        return idx === -1 ? '' : values[i][idx];
      };

      return {
        found: true,
        alreadyConfirmed: alreadyConfirmed,
        sheet: sheet.getName(),
        title: col('Danh xưng'),
        fullName: col('Họ tên'),
        position: col('Chức danh'),
        company: col('Tên công ty'),
        eventKey: col('Sự kiện'),
      };
    }
  }

  return { found: false };
}

function normalize(v) {
  return String(v === null || v === undefined ? '' : v).trim().toLowerCase();
}

// Lấy tab theo tên; nếu chưa có thì tạo mới + kẻ tiêu đề (in đậm, freeze).
function getOrCreateEventSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  sheet = ss.insertSheet(name);
  sheet.appendRow(HEADERS);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

// Google Sheets cấm các ký tự : \ / ? * [ ] trong tên tab, và tối đa 100 ký tự.
function sanitizeSheetName(name) {
  var clean = String(name).replace(/[:\\\/?*\[\]]/g, '-').trim();
  if (!clean) clean = 'Khác';
  return clean.substring(0, 100);
}
