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
var HEADERS = ['Thời gian', 'Danh xưng', 'Họ tên', 'Số điện thoại', 'Chức danh', 'Tên công ty', 'Sự kiện', 'Token', 'Lucky Number'];

// Cột 1-indexed dùng để tra cứu khi kiểm tra trùng.
var COL_TITLE = 2;
var COL_FULLNAME = 3;
var COL_PHONE = 4;
var COL_POSITION = 5;
var COL_COMPANY = 6;
// Cột 8 = Token (mã QR check-in, xem src/utils/token.js) — chỉ ghi, không
// dùng để tra trùng.
//
// Đã bỏ cột "Trạng thái" (đánh dấu đã check-in) theo yêu cầu — check-in quét
// QR (findAndConfirmToken bên dưới) vẫn chạy được, chỉ là không còn báo được
// "đã check-in trước đó" nữa vì không còn nơi để lưu trạng thái đó.
var STATUS_CONFIRMED = 'Đã xác nhận';

// Cột 9 = Lucky Number — số 4 chữ số (0001-9999) DUY NHẤT trong tab, dùng
// cho vòng quay may mắn. Cấp số ở generateUniqueLuckyNumber() bên dưới, có
// khoá (LockService) để 2 người tạo thiệp cùng lúc không bị cấp trùng số.
var COL_LUCKY = 9;
var LUCKY_MIN = 1;
var LUCKY_MAX = 9999;

// Mở URL bằng trình duyệt -> thấy dòng này = script sống.
function doGet() {
  return ContentService.createTextOutput("Lead webhook OK");
}

// Nhận POST từ Vercel /api/lead (tạo/tra trùng lead) hoặc /api/checkin
// (đội quét QR xác nhận check-in).
// data.action: 'check' (tra trùng, không ghi) | 'update' (ghi đè dòng đã
// chọn) | 'checkin' (quét QR — xem findAndConfirmToken) | mặc định = tạo
// dòng mới.
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

    // Khoá toàn script trong lúc cấp Lucky Number + ghi dòng: nếu 2 người
    // tạo thiệp cùng lúc, request thứ 2 phải đợi request thứ 1 ghi xong rồi
    // mới đọc lại danh sách số đã cấp — nếu không, cả hai có thể đọc thấy
    // cùng 1 số còn trống và cấp trùng nhau.
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var luckyNumber;
      if (data.action === 'update' && data.matchRecord && data.matchRecord.luckyNumber) {
        // Thay thế bản ghi cũ (sửa thông tin) của CÙNG một khách -> giữ
        // nguyên Lucky Number đã cấp trước đó, không cấp số mới.
        luckyNumber = data.matchRecord.luckyNumber;
      } else {
        luckyNumber = generateUniqueLuckyNumber(sheet);
      }

      var row = [
        data.time || new Date(),
        data.title || "",
        data.fullName || "",
        data.phone || "",
        data.position || "",
        data.company || "",
        data.eventKey || "",
        data.token || "",
        // Dấu ' phía trước ép Sheets lưu dạng CHỮ (Plain text) — nếu không,
        // Sheets tự nhận "0001" là số rồi bỏ số 0 ở đầu thành 1, sai định
        // dạng 4 chữ số và làm lệch việc so khớp số đã cấp ở lần sau.
        luckyNumber ? "'" + luckyNumber : "",
      ];

      // Thay thế: tìm đúng dòng khớp với bản ghi cũ (matchRecord) rồi ghi đè.
      // Nếu không tìm thấy nữa (bị xoá/sửa giữa lúc check và submit) -> vẫn
      // thêm dòng mới để không mất dữ liệu người dùng vừa nhập.
      if (data.action === 'update' && data.matchRecord) {
        var rowIndex = findRowIndex(sheet, data.matchRecord);
        if (rowIndex) {
          sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
          return jsonOutput({ ok: true, sheet: sheetName, replaced: true, luckyNumber: luckyNumber });
        }
      }

      sheet.appendRow(row);
      return jsonOutput({ ok: true, sheet: sheetName, replaced: false, luckyNumber: luckyNumber });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err) });
  }
}

// Cấp 1 số 4 chữ số (dạng chuỗi "0001".."9999") CHƯA có trong cột Lucky
// Number của tab này. Thử ngẫu nhiên vài chục lần trước (nhanh, đủ dùng khi
// tab còn nhiều số trống); nếu tab gần đầy (hiếm khi nào tới 9999 khách một
// sự kiện) mới rơi xuống quét tuần tự để chắc chắn tìm được số còn trống.
function generateUniqueLuckyNumber(sheet) {
  var values = sheet.getDataRange().getValues();
  // So khớp theo GIÁ TRỊ SỐ (parseInt), không theo chuỗi "0001" — để không
  // bị lệch nếu 1 ô nào đó lỡ bị Sheets lưu thành số (vd người dùng tự gõ
  // tay sửa lại, mất số 0 ở đầu).
  var used = {};
  for (var i = 1; i < values.length; i++) {
    var n = parseInt(values[i][COL_LUCKY - 1], 10);
    if (!isNaN(n)) used[n] = true;
  }

  for (var attempt = 0; attempt < 200; attempt++) {
    var candidate = LUCKY_MIN + Math.floor(Math.random() * (LUCKY_MAX - LUCKY_MIN + 1));
    if (!used[candidate]) return padLuckyNumber(candidate);
  }
  for (var n2 = LUCKY_MIN; n2 <= LUCKY_MAX; n2++) {
    if (!used[n2]) return padLuckyNumber(n2);
  }
  return ''; // đã cấp hết toàn bộ 9999 số trong tab này
}

function padLuckyNumber(n) {
  return ('0000' + n).slice(-4);
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
        phone: r[COL_PHONE - 1],
        position: r[COL_POSITION - 1],
        company: r[COL_COMPANY - 1],
        luckyNumber: r[COL_LUCKY - 1],
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
// hoa/thường) rồi trả về thông tin khách để app quét QR hiển thị xác nhận
// trên màn hình.
// Tra theo TÊN cột (không theo số cột cố định) để không vỡ nếu tab cũ
// (tạo trước khi có cột Token) có ít cột hơn, hoặc tab cũ vẫn còn cột
// "Trạng thái" (đã bỏ khỏi HEADERS nhưng tab có sẵn từ trước vẫn giữ
// nguyên cột đó) — nếu còn, vẫn cập nhật sang STATUS_CONFIRMED để không mất
// dữ liệu đang theo dõi trên tab cũ.
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
        phone: col('Số điện thoại'),
        position: col('Chức danh'),
        company: col('Tên công ty'),
        eventKey: col('Sự kiện'),
        luckyNumber: col('Lucky Number'),
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
