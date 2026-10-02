const SCRIPT_SECRET_PROPERTY = "SCRIPT_SECRET";
const DEFAULT_SHEET_NAME = "";

const FIELD_ALIASES = {
  nickname: ["Никнейм", "Nickname", "Ник"],
  age: ["Возраст", "Age"],
  pc_access: ["Доступ с ПК", "Доступ с пк", "PC", "PC access"],
  position: ["Должность", "Position"],
  levels: ["Уровни", "Уровень", "Levels"],
  activity_points: ["Баллы активности", "Баллы активност", "Активность", "Activity points"],
  inactives: ["Неактивы", "Неактив", "Inactives"],
  strikes: ["Страйки", "Страйк", "Strikes"],
  warnings: ["Предупреждения", "Предупреждение", "Преды", "Warnings"],
  points: ["Баллы", "Балл", "Points"],
  last_promotion: ["Последнее повышение", "Last promotion"]
};

function doGet() {
  return jsonResponse({
    success: true,
    service: "br-admin-tools",
    status: "ok"
  });
}

function doPost(e) {
  try {
    const body = parseBody(e);
    checkSecret(body.secret);

    const action = String(body.action || "").trim();

    switch (action) {
      case "health":
        return jsonResponse({
          success: true,
          service: "br-admin-tools",
          status: "ok"
        });

      case "get_admin":
        return jsonResponse(getAdmin(body.nickname));

      case "get_row":
        return jsonResponse(getRow(body.row_number, body.sheet_name));

      case "get_all_admins":
        return jsonResponse(getAllAdmins(body.sheet_name));

      case "update_admin":
        return jsonResponse(
          updateAdmin(
            body.nickname,
            body.changes,
            body.sheet_name
          )
        );

      case "update_row":
        return jsonResponse(
          updateRow(
            body.row_number,
            body.changes,
            body.sheet_name
          )
        );

      case "append_admin":
        return jsonResponse(
          appendAdmin(
            body.values,
            body.sheet_name
          )
        );

      default:
        throw new Error("UNKNOWN_ACTION");
    }
  } catch (error) {
    return jsonResponse({
      success: false,
      code: error instanceof Error
        ? error.message
        : "INTERNAL_ERROR",
      message: messageForError(
        error instanceof Error
          ? error.message
          : "INTERNAL_ERROR"
      )
    });
  }
}

function parseBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("EMPTY_REQUEST");
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error("INVALID_JSON");
  }
}

function checkSecret(value) {
  const expected = PropertiesService
    .getScriptProperties()
    .getProperty(SCRIPT_SECRET_PROPERTY);

  if (!expected) {
    throw new Error("SCRIPT_SECRET_NOT_CONFIGURED");
  }

  if (
    typeof value !== "string" ||
    !value ||
    value !== expected
  ) {
    throw new Error("UNAUTHORIZED");
  }
}

function getSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("SPREADSHEET_NOT_FOUND");
  }

  return spreadsheet;
}

function getSheet(sheetName) {
  const spreadsheet = getSpreadsheet();
  const requested = String(sheetName || DEFAULT_SHEET_NAME).trim();

  if (requested) {
    const sheet = spreadsheet.getSheetByName(requested);

    if (!sheet) {
      throw new Error("SHEET_NOT_FOUND");
    }

    return sheet;
  }

  const sheets = spreadsheet.getSheets();

  for (const sheet of sheets) {
    const header = findHeader(sheet);

    if (header) {
      return sheet;
    }
  }

  throw new Error("SHEET_NOT_FOUND");
}

function getValues(sheet) {
  const range = sheet.getDataRange();

  if (!range) {
    return [];
  }

  const values = range.getValues();

  return values.map(row =>
    row.map(value =>
      value instanceof Date
        ? value.toISOString()
        : value
    )
  );
}

function normalize(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/ё/g, "е")
    .replace(/[\s_-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizeHeader(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function fieldFromHeader(header) {
  const normalized = normalizeHeader(header);

  for (const field in FIELD_ALIASES) {
    const aliases = FIELD_ALIASES[field];

    for (const alias of aliases) {
      if (normalizeHeader(alias) === normalized) {
        return field;
      }
    }
  }

  return null;
}

function findHeader(sheet, maxRows) {
  const values = getValues(sheet);
  const limit = Math.min(
    values.length,
    Number(maxRows || values.length)
  );

  for (let rowIndex = 0; rowIndex < limit; rowIndex++) {
    const row = values[rowIndex] || [];
    let hasNickname = false;
    let hasPosition = false;

    for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
      const field = fieldFromHeader(row[columnIndex]);

      if (field === "nickname") {
        hasNickname = true;
      }

      if (field === "position") {
        hasPosition = true;
      }
    }

    if (hasNickname && hasPosition) {
      return {
        rowIndex,
        headers: row
      };
    }
  }

  return null;
}

function findHeaderForRow(values, rowIndex) {
  for (let index = rowIndex; index >= 0; index--) {
    const row = values[index] || [];
    let hasNickname = false;
    let hasPosition = false;

    for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
      const field = fieldFromHeader(row[columnIndex]);

      if (field === "nickname") {
        hasNickname = true;
      }

      if (field === "position") {
        hasPosition = true;
      }
    }

    if (hasNickname && hasPosition) {
      return {
        rowIndex: index,
        headers: row
      };
    }
  }

  return findHeaderFromTop(values);
}

function findHeaderFromTop(values) {
  for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex] || [];
    let hasNickname = false;
    let hasPosition = false;

    for (let columnIndex = 0; columnIndex < row.length; columnIndex++) {
      const field = fieldFromHeader(row[columnIndex]);

      if (field === "nickname") {
        hasNickname = true;
      }

      if (field === "position") {
        hasPosition = true;
      }
    }

    if (hasNickname && hasPosition) {
      return {
        rowIndex,
        headers: row
      };
    }
  }

  throw new Error("HEADERS_NOT_FOUND");
}

function headerMap(headers) {
  const map = {};

  for (let columnIndex = 0; columnIndex < headers.length; columnIndex++) {
    const field = fieldFromHeader(headers[columnIndex]);

    if (field && map[field] === undefined) {
      map[field] = columnIndex;
    }
  }

  return map;
}

function rowToObject(values, rowIndex, headerInfo) {
  const row = values[rowIndex] || [];
  const map = headerMap(headerInfo.headers);
  const result = {};

  for (const field in map) {
    const columnIndex = map[field];
    result[field] = row[columnIndex] == null
      ? ""
      : row[columnIndex];
  }

  result.nickname = result.nickname || "";
  result.row_number = rowIndex + 1;
  result.headers = headerInfo.headers;
  result.raw_row = row;

  return result;
}

function findAdminPosition(values, nickname) {
  const target = normalize(nickname);

  if (!target) {
    throw new Error("NICKNAME_REQUIRED");
  }

  for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex] || [];
    const headerInfo = findHeaderForRow(values, rowIndex);

    if (
      !headerInfo ||
      rowIndex <= headerInfo.rowIndex
    ) {
      continue;
    }

    const map = headerMap(headerInfo.headers);
    const nicknameColumn = map.nickname;

    if (nicknameColumn === undefined) {
      continue;
    }

    if (
      normalize(row[nicknameColumn]) === target
    ) {
      return {
        rowIndex,
        headerInfo
      };
    }
  }

  throw new Error("STATISTICS_NOT_FOUND");
}

function getAdmin(nickname) {
  const sheet = getSheet();
  const values = getValues(sheet);
  const found = findAdminPosition(values, nickname);
  const admin = rowToObject(
    values,
    found.rowIndex,
    found.headerInfo
  );

  return {
    success: true,
    sheet_name: sheet.getName(),
    row_number: found.rowIndex + 1,
    admin
  };
}

function getRow(rowNumber, sheetName) {
  const sheet = getSheet(sheetName);
  const rowNumberValue = Number(rowNumber);

  if (
    !Number.isInteger(rowNumberValue) ||
    rowNumberValue < 1 ||
    rowNumberValue > sheet.getMaxRows()
  ) {
    throw new Error("ROW_NUMBER_INVALID");
  }

  const values = getValues(sheet);
  const rowIndex = rowNumberValue - 1;
  const headerInfo = findHeaderForRow(values, rowIndex);
  const row = values[rowIndex] || [];

  return {
    success: true,
    sheet_name: sheet.getName(),
    row_number: rowNumberValue,
    row: rowToObject(
      values,
      rowIndex,
      headerInfo
    )
  };
}

function getAllAdmins(sheetName) {
  const sheet = getSheet(sheetName);
  const values = getValues(sheet);
  const result = [];
  const seenRows = {};

  for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
    const headerInfo = findHeaderForRow(values, rowIndex);

    if (
      !headerInfo ||
      rowIndex <= headerInfo.rowIndex
    ) {
      continue;
    }

    const map = headerMap(headerInfo.headers);
    const nicknameColumn = map.nickname;

    if (nicknameColumn === undefined) {
      continue;
    }

    const nickname = String(
      values[rowIndex][nicknameColumn] == null
        ? ""
        : values[rowIndex][nicknameColumn]
    ).trim();

    if (!nickname || normalizeHeader(nickname) === "никнейм") {
      continue;
    }

    if (seenRows[rowIndex]) {
      continue;
    }

    seenRows[rowIndex] = true;

    result.push(
      rowToObject(
        values,
        rowIndex,
        headerInfo
      )
    );
  }

  return {
    success: true,
    sheet_name: sheet.getName(),
    statistics: result
  };
}

function updateAdmin(nickname, changes, sheetName) {
  const sheet = getSheet(sheetName);
  const values = getValues(sheet);
  const found = findAdminPosition(values, nickname);

  return updateFoundRow(
    sheet,
    values,
    found.rowIndex,
    found.headerInfo,
    changes
  );
}

function updateRow(rowNumber, changes, sheetName) {
  const sheet = getSheet(sheetName);
  const rowNumberValue = Number(rowNumber);

  if (
    !Number.isInteger(rowNumberValue) ||
    rowNumberValue < 1 ||
    rowNumberValue > sheet.getMaxRows()
  ) {
    throw new Error("ROW_NUMBER_INVALID");
  }

  const values = getValues(sheet);
  const rowIndex = rowNumberValue - 1;
  const headerInfo = findHeaderForRow(values, rowIndex);

  return updateFoundRow(
    sheet,
    values,
    rowIndex,
    headerInfo,
    changes
  );
}

function updateFoundRow(
  sheet,
  values,
  rowIndex,
  headerInfo,
  changes
) {
  if (
    !changes ||
    typeof changes !== "object" ||
    Array.isArray(changes)
  ) {
    throw new Error("CHANGES_REQUIRED");
  }

  const map = headerMap(headerInfo.headers);
  const entries = Object.entries(changes);

  if (!entries.length) {
    throw new Error("CHANGES_REQUIRED");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const updatedFields = [];

    for (const [requestedField, value] of entries) {
      const field = resolveField(requestedField);

      if (!field) {
        throw new Error("FIELD_NOT_ALLOWED");
      }

      const columnIndex = map[field];

      if (columnIndex === undefined) {
        throw new Error("FIELD_NOT_FOUND");
      }

      sheet
        .getRange(
          rowIndex + 1,
          columnIndex + 1
        )
        .setValue(value);

      updatedFields.push({
        field,
        column: columnIndex + 1,
        value
      });
    }

    SpreadsheetApp.flush();

    return {
      success: true,
      sheet_name: sheet.getName(),
      row_number: rowIndex + 1,
      updated: updatedFields
    };
  } finally {
    lock.releaseLock();
  }
}

function resolveField(value) {
  const normalized = normalizeHeader(value);

  const direct = Object.keys(FIELD_ALIASES).find(
    field =>
      normalizeHeader(field) === normalized
  );

  if (direct) {
    return direct;
  }

  for (const field in FIELD_ALIASES) {
    for (const alias of FIELD_ALIASES[field]) {
      if (
        normalizeHeader(alias) === normalized
      ) {
        return field;
      }
    }
  }

  return null;
}

function appendAdmin(values, sheetName) {
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values)
  ) {
    throw new Error("VALUES_REQUIRED");
  }

  const sheet = getSheet(sheetName);
  const headerInfo = findHeader(sheet);

  if (!headerInfo) {
    throw new Error("HEADERS_NOT_FOUND");
  }

  const map = headerMap(headerInfo.headers);
  const row = Array(headerInfo.headers.length).fill("");

  for (const [requestedField, value] of Object.entries(values)) {
    const field = resolveField(requestedField);

    if (!field) {
      throw new Error("FIELD_NOT_ALLOWED");
    }

    const columnIndex = map[field];

    if (columnIndex === undefined) {
      throw new Error("FIELD_NOT_FOUND");
    }

    row[columnIndex] = value;
  }

  const nicknameColumn = map.nickname;

  if (
    nicknameColumn === undefined ||
    !String(row[nicknameColumn] || "").trim()
  ) {
    throw new Error("NICKNAME_REQUIRED");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const targetRow = Math.max(
      headerInfo.rowIndex + 2,
      sheet.getLastRow() + 1
    );

    sheet
      .getRange(
        targetRow,
        1,
        1,
        row.length
      )
      .setValues([row]);

    SpreadsheetApp.flush();

    return {
      success: true,
      sheet_name: sheet.getName(),
      row_number: targetRow,
      row: row
    };
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(
      JSON.stringify(data)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}

function messageForError(code) {
  const messages = {
    EMPTY_REQUEST: "Пустой запрос",
    INVALID_JSON: "Некорректный JSON",
    SCRIPT_SECRET_NOT_CONFIGURED: "Не настроен секрет Apps Script",
    UNAUTHORIZED: "Недействительный секрет",
    SPREADSHEET_NOT_FOUND: "Таблица не найдена",
    SHEET_NOT_FOUND: "Лист не найден",
    HEADERS_NOT_FOUND: "Заголовки администрации не найдены",
    NICKNAME_REQUIRED: "Не передан никнейм",
    STATISTICS_NOT_FOUND: "Администратор не найден в таблице",
    ROW_NUMBER_INVALID: "Некорректный номер строки",
    CHANGES_REQUIRED: "Не переданы изменения",
    FIELD_NOT_ALLOWED: "Недопустимое поле",
    FIELD_NOT_FOUND: "Нужное поле отсутствует в таблице",
    VALUES_REQUIRED: "Не переданы данные",
    UNKNOWN_ACTION: "Неизвестное действие",
    INTERNAL_ERROR: "Внутренняя ошибка"
  };

  return messages[code] || "Внутренняя ошибка";
}
