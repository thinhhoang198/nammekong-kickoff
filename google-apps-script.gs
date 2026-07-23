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
var HEADERS = ['Thời gian', 'Danh xưng', 'Họ tên', 'Số điện thoại', 'Chức danh', 'Tên công ty', 'Sự kiện', 'Token', 'Lucky Number', 'Trạng thái đồng bộ'];

// Cột 1-indexed dùng để tra cứu khi kiểm tra trùng.
var COL_TITLE = 2;
var COL_FULLNAME = 3;
var COL_PHONE = 4;
var COL_POSITION = 5;
var COL_COMPANY = 6;
// Token (mã QR check-in, xem src/utils/token.js) — không dùng để tra trùng,
// nhưng MỘT KHI đã cấp cho 1 khách thì khoá vĩnh viễn với khách đó (xem
// doPost: sửa thông tin không được đổi Token/Lucky Number cũ).
var COL_TOKEN = 8;
//
// Đã bỏ cột "Trạng thái" (đánh dấu đã check-in) theo yêu cầu — check-in quét
// QR (findAndConfirmToken bên dưới) vẫn chạy được, chỉ là không còn báo được
// "đã check-in trước đó" nữa vì không còn nơi để lưu trạng thái đó.
var STATUS_CONFIRMED = 'Đã xác nhận';

// Cột 9 = Lucky Number — số 4 chữ số (0001-9999) DUY NHẤT trong tab, dùng
// cho vòng quay may mắn. Cấp số ở generateUniqueLuckyNumber() bên dưới, có
// khoá (LockService) để 2 người tạo thiệp cùng lúc không bị cấp trùng số.
//
// QUY TẮC KHOÁ Token/Lucky Number: một khi đã cấp cho 1 khách (1 dòng trên
// sheet) thì giữ NGUYÊN mãi mãi cho khách đó — sửa thông tin (action update)
// KHÔNG được đổi 2 giá trị này. doPost() luôn đọc lại giá trị hiện tại
// TRỰC TIẾP TỪ SHEET (không tin dữ liệu client cache gửi lên) để không bị
// lệch nếu admin đã sửa sheet tay giữa lúc khách bấm "tạo thiệp" và lúc
// submit thật sự. Nếu ô Token/Lucky Number của 1 dòng bị admin xoá tay (còn
// trống) hoặc cả dòng bị xoá hẳn -> coi như "chưa từng cấp", sẽ cấp giá trị
// MỚI ở lần tạo/sửa tiếp theo — tức giá trị cũ bị xoá sẽ tự động "trả lại"
// cho lần cấp sau (vì generateUniqueLuckyNumber quét lại toàn bộ sheet mỗi
// lần gọi, nên số nào không còn xuất hiện trong sheet coi như còn trống).
var COL_LUCKY = 9;
var LUCKY_MIN = 1;
var LUCKY_MAX = 9999;

// Cột 10 = Trạng thái đồng bộ — CỐ Ý đặt tên khác cột "Trạng thái" cũ (đã bỏ
// ở trên, từng dùng cho check-in) để findAndConfirmToken() không lỡ ghi đè
// nhầm lên cột này khi có người quét QR check-in (nó tìm cột theo đúng TÊN
// "Trạng thái", không khớp "Trạng thái đồng bộ" nên an toàn).
//
// 3 giá trị: "Chờ xác nhận" | "Đã đồng bộ" | "Đồng bộ lỗi". App CHỈ ghi giá
// trị mặc định "Chờ xác nhận" lúc tạo dòng mới — việc đổi sang "Đã đồng bộ"
// / "Đồng bộ lỗi" do một công cụ/quy trình khác bên ngoài cập nhật (app
// không tự đổi 2 trạng thái này). Giữ NGUYÊN khi sửa thông tin khách đã có
// (cùng quy tắc với Token/Lucky Number) — sửa 1 vài trường không tự ý coi
// như "phải đồng bộ lại". Nếu ô này bị admin xoá tay -> coi như chưa có,
// cấp lại "Chờ xác nhận" ở lần sửa tiếp theo. Field này KHÔNG in lên thiệp.
var COL_SYNC = 10;
var SYNC_STATUS_PENDING = 'Chờ xác nhận';

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

    // Khoá toàn script trong lúc đọc/cấp Token + Lucky Number + ghi dòng: nếu
    // 2 người tạo/sửa thiệp cùng lúc, request thứ 2 phải đợi request thứ 1
    // ghi xong rồi mới đọc lại sheet — nếu không, cả hai có thể đọc thấy
    // cùng 1 số Lucky Number còn trống và cấp trùng nhau.
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      // Nếu đang sửa 1 khách đã có dòng trên sheet -> tìm đúng dòng đó
      // TRƯỚC, rồi đọc Token/Lucky Number HIỆN TẠI của chính dòng đó trực
      // tiếp từ sheet (không dùng data.matchRecord do client cache) để luôn
      // khớp với sheet thật, kể cả khi admin vừa sửa tay.
      var rowIndex = null;
      var existingToken = '';
      var existingLucky = '';
      var existingSync = '';
      if (data.action === 'update' && data.matchRecord) {
        rowIndex = findRowIndex(sheet, data.matchRecord);
        if (rowIndex) {
          var existingRow = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
          // Chỉ trim, KHÔNG dùng normalize() (sẽ lowercase) — Token cần giữ
          // nguyên dạng chữ HOA gốc khi ghi lại / vẽ lại lên thiệp.
          existingToken = String(existingRow[COL_TOKEN - 1] || '').trim();
          existingLucky = String(existingRow[COL_LUCKY - 1] || '').trim();
          existingSync = String(existingRow[COL_SYNC - 1] || '').trim();
          // Phòng trường hợp ô Lucky Number lỡ bị lưu thành SỐ (mất số 0 ở
          // đầu, vd "7" thay vì "0007") — vd người dùng tự gõ tay sửa lại.
          if (existingLucky && /^\d+$/.test(existingLucky)) {
            existingLucky = padLuckyNumber(parseInt(existingLucky, 10));
          }
        }
      }

      // Token: giữ nguyên nếu dòng cũ đang có; nếu trống (bị admin xoá tay,
      // hoặc khách hoàn toàn mới) thì dùng token client vừa sinh.
      var token = existingToken || data.token || '';

      // Lucky Number: giữ nguyên nếu dòng cũ đang có; nếu trống (bị admin
      // xoá tay, hoặc khách hoàn toàn mới) thì cấp số MỚI, duy nhất trong
      // tab — số cũ (nếu có, đã bị xoá) coi như trả lại, có thể được cấp
      // cho người khác.
      var luckyNumber = existingLucky || generateUniqueLuckyNumber(sheet);

      // Trạng thái đồng bộ: giữ nguyên nếu dòng cũ đang có (vd đã được 1 quy
      // trình bên ngoài đánh dấu "Đã đồng bộ" — sửa vài trường không tự ý
      // coi như phải đồng bộ lại); nếu trống thì đặt mặc định "Chờ xác nhận".
      var syncStatus = existingSync || SYNC_STATUS_PENDING;

      var row = [
        data.time || new Date(),
        data.title || "",
        data.fullName || "",
        data.phone || "",
        data.position || "",
        data.company || "",
        data.eventKey || "",
        token,
        // Dấu ' phía trước ép Sheets lưu dạng CHỮ (Plain text) — nếu không,
        // Sheets tự nhận "0001" là số rồi bỏ số 0 ở đầu thành 1, sai định
        // dạng 4 chữ số và làm lệch việc so khớp số đã cấp ở lần sau.
        luckyNumber ? "'" + luckyNumber : "",
        syncStatus,
      ];

      // rowIndex đã xác định ở trên (null nếu tạo mới, hoặc "update" nhưng
      // dòng cũ không tìm thấy nữa — vd bị xoá/sửa giữa lúc check và submit
      // -> vẫn thêm dòng mới để không mất dữ liệu người dùng vừa nhập, và
      // Token/Lucky Number ở trên đã tự rơi về nhánh "cấp mới" cho đúng).
      if (rowIndex) {
        sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
        return jsonOutput({ ok: true, sheet: sheetName, replaced: true, token: token, luckyNumber: luckyNumber });
      }

      sheet.appendRow(row);
      return jsonOutput({ ok: true, sheet: sheetName, replaced: false, token: token, luckyNumber: luckyNumber });
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
