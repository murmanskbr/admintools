const SCRIPT_SECRET_PROPERTY = "SCRIPT_SECRET";
const SPREADSHEET_ID_PROPERTY = "BOUND_SPREADSHEET_ID";
const SHEET_NAME_PROPERTY = "BOUND_SHEET_NAME";
const DEFAULT_SHEET_NAME = "admins";

const FIELD_ALIASES = {
  nickname: [
    "Никнейм",
    "Ник",
    "Игровой ник",
    "Игровой никнейм",
    "Nickname",
    "Nick"
  ],
  age: ["Возраст", "Age"],
  pc_access: [
    "Доступ с ПК",
    "Доступ с пк",
    "ПК",
    "Пк",
    "PC",
    "PC access",
    "Есть ПК"
  ],
  position: ["Должность", "Позиция", "Position"],
  levels: [
    "Уровни",
    "Уровень",
    "Количество уровней",
    "Кол-во уровней",
    "Levels"
  ],
  activity_points: [
    "Баллы активности",
    "Баллы активност",
    "Активность",
    "Activity points"
  ],
  inactives: [
    "Неактивы",
    "Неактив",
    "Периоды неактива",
    "Inactives"
  ],
  strikes: ["Страйки", "Страйк", "Strikes"],
  warnings: [
    "Предупреждения",
    "Предупреждение",
    "Преды",
    "Пред",
    "Warnings"
  ],
  points: ["Баллы", "Балл", "Points"],
  last_promotion: [
    "Последнее повышение",
    "Дата последнего повышения",
    "Последнее повыш.",
    "Last promotion"
  ]
};

function onOpen() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    if (spreadsheet) {
      PropertiesService
        .getScriptProperties()
        .setProperty(
          SPREADSHEET_ID_PROPERTY,
          spreadsheet.getId()
        );
    }
  } catch (error) {
    console.error("onOpen error", error);
  }
}

function setupSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("SPREADSHEET_NOT_FOUND");
  }

  const properties =
    PropertiesService.getScriptProperties();

  properties.setProperty(
    SPREADSHEET_ID_PROPERTY,
    spreadsheet.getId()
  );

  const sheet = findBestSheet(
    spreadsheet,
    properties.getProperty(
      SHEET_NAME_PROPERTY
    )
  );

  properties.setProperty(
    SHEET_NAME_PROPERTY,
    sheet.getName()
  );

  let secret =
    properties.getProperty(
      SCRIPT_SECRET_PROPERTY
    );

  if (!secret) {
    secret = generateSecret();

    properties.setProperty(
      SCRIPT_SECRET_PROPERTY,
      secret
    );
  }

  const result = {
    success: true,
    spreadsheet_id: spreadsheet.getId(),
    sheet_name: sheet.getName(),
    script_secret: secret
  };

  Logger.log(JSON.stringify(result));

  return result;
}

function rotateSecret() {
  const secret = generateSecret();

  PropertiesService
    .getScriptProperties()
    .setProperty(
      SCRIPT_SECRET_PROPERTY,
      secret
    );

  Logger.log(
    JSON.stringify({
      success: true,
      script_secret: secret
    })
  );

  return {
    success: true,
    script_secret: secret
  };
}

function generateSecret() {
  return (
    Utilities.getUuid().replace(/-/g, "") +
    Utilities.getUuid().replace(/-/g, "")
  );
}

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

    const action =
      String(body.action || "").trim();

    switch (action) {
      case "health":
        return jsonResponse(
          health()
        );

      case "diagnostics":
        return jsonResponse(
          diagnostics()
        );

      case "get_admin":
        return jsonResponse(
          getAdmin(body.nickname, body.sheet_name)
        );

      case "get_row":
        return jsonResponse(
          getRow(
            body.row_number,
            body.sheet_name
          )
        );

      case "get_all_admins":
        return jsonResponse(
          getAllAdmins(body.sheet_name)
        );

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
    const code =
      error instanceof Error
        ? error.message
        : "INTERNAL_ERROR";

    return jsonResponse({
      success: false,
      code,
      message: messageForError(code)
    });
  }
}

function parseBody(e) {
  if (
    !e ||
    !e.postData ||
    !e.postData.contents
  ) {
    throw new Error("EMPTY_REQUEST");
  }

  try {
    return JSON.parse(
      e.postData.contents
    );
  } catch (_error) {
    throw new Error("INVALID_JSON");
  }
}

function checkSecret(value) {
  const expected =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        SCRIPT_SECRET_PROPERTY
      );

  if (!expected) {
    throw new Error(
      "SCRIPT_SECRET_NOT_CONFIGURED"
    );
  }

  if (
    typeof value !== "string" ||
    !value ||
    value !== expected
  ) {
    throw new Error("UNAUTHORIZED");
  }
}

function health() {
  const properties =
    PropertiesService
      .getScriptProperties();

  const spreadsheetId =
    properties.getProperty(
      SPREADSHEET_ID_PROPERTY
    );

  const configured =
    Boolean(spreadsheetId);

  let sheetName =
    properties.getProperty(
      SHEET_NAME_PROPERTY
    );

  if (configured && !sheetName) {
    try {
      sheetName =
        getSheet().getName();
    } catch (_error) {
      sheetName = "";
    }
  }

  return {
    success: true,
    service: "br-admin-tools",
    status: "ok",
    configured,
    sheet_name: sheetName || null
  };
}

function diagnostics() {
  const spreadsheet = getSpreadsheet();
  const sheets = spreadsheet
    .getSheets()
    .map(sheet => {
      const values =
        getDisplayValues(sheet);

      const headerInfo =
        findHeaderInfo(values);

      return {
        name: sheet.getName(),
        rows: values.length,
        columns: values[0]
          ? values[0].length
          : 0,
        header_row:
          headerInfo
            ? headerInfo.rowIndex + 1
            : null,
        headers:
          headerInfo
            ? headerInfo.headers
            : []
      };
    });

  return {
    success: true,
    service: "br-admin-tools",
    spreadsheet_id:
      spreadsheet.getId(),
    sheets
  };
}

function getSpreadsheet() {
  const properties =
    PropertiesService
      .getScriptProperties();

  const spreadsheetId =
    properties.getProperty(
      SPREADSHEET_ID_PROPERTY
    );

  if (!spreadsheetId) {
    throw new Error(
      "SPREADSHEET_NOT_INITIALIZED"
    );
  }

  try {
    return SpreadsheetApp.openById(
      spreadsheetId
    );
  } catch (error) {
    console.error(
      "SPREADSHEET OPEN ERROR",
      error
    );

    throw new Error(
      "SPREADSHEET_NOT_FOUND"
    );
  }
}

function getSheet(sheetName) {
  const spreadsheet =
    getSpreadsheet();

  const requested =
    String(
      sheetName ||
      PropertiesService
        .getScriptProperties()
        .getProperty(
          SHEET_NAME_PROPERTY
        ) ||
      DEFAULT_SHEET_NAME
    ).trim();

  if (requested) {
    const direct =
      spreadsheet.getSheetByName(
        requested
      );

    if (direct) {
      return direct;
    }

    if (
      requested !== DEFAULT_SHEET_NAME
    ) {
      throw new Error(
        "SHEET_NOT_FOUND"
      );
    }
  }

  return findBestSheet(
    spreadsheet,
    ""
  );
}

function findBestSheet(
  spreadsheet,
  preferredName
) {
  if (preferredName) {
    const preferred =
      spreadsheet.getSheetByName(
        preferredName
      );

    if (preferred) {
      return preferred;
    }
  }

  const defaultSheet =
    spreadsheet.getSheetByName(
      DEFAULT_SHEET_NAME
    );

  if (defaultSheet) {
    const values =
      getDisplayValues(
        defaultSheet
      );

    if (findHeaderInfo(values)) {
      return defaultSheet;
    }
  }

  for (
    const sheet of spreadsheet.getSheets()
  ) {
    const values =
      getDisplayValues(sheet);

    if (findHeaderInfo(values)) {
      return sheet;
    }
  }

  throw new Error(
    "SHEET_NOT_FOUND"
  );
}

function getDisplayValues(sheet) {
  const range =
    sheet.getDataRange();

  if (!range) {
    return [];
  }

  return range.getDisplayValues();
}

function normalize(value) {
  return String(
    value == null ? "" : value
  )
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/ё/g, "е")
    .replace(/[\s_-]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function normalizeHeader(value) {
  return String(
    value == null ? "" : value
  )
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/ё/g, "е")
    .replace(
      /[^\p{L}\p{N}]+/gu,
      ""
    );
}

function fieldFromHeader(value) {
  const normalized =
    normalizeHeader(value);

  for (
    const field in FIELD_ALIASES
  ) {
    for (
      const alias of
      FIELD_ALIASES[field]
    ) {
      if (
        normalizeHeader(alias) ===
        normalized
      ) {
        return field;
      }
    }
  }

  return null;
}

function resolveField(value) {
  const normalized =
    normalizeHeader(value);

  for (
    const field of
    Object.keys(FIELD_ALIASES)
  ) {
    if (
      normalizeHeader(field) ===
      normalized
    ) {
      return field;
    }
  }

  for (
    const field in FIELD_ALIASES
  ) {
    for (
      const alias of
      FIELD_ALIASES[field]
    ) {
      if (
        normalizeHeader(alias) ===
        normalized
      ) {
        return field;
      }
    }
  }

  return null;
}

function headerIsUsable(row) {
  let hasNickname = false;
  let knownFields = 0;

  for (
    let columnIndex = 0;
    columnIndex < row.length;
    columnIndex++
  ) {
    const field =
      fieldFromHeader(
        row[columnIndex]
      );

    if (field === "nickname") {
      hasNickname = true;
    }

    if (field) {
      knownFields += 1;
    }
  }

  return (
    hasNickname &&
    knownFields >= 2
  );
}

function findHeaderInfo(values) {
  const maxRows =
    Math.min(
      values.length,
      30
    );

  for (
    let rowIndex = 0;
    rowIndex < maxRows;
    rowIndex++
  ) {
    const row =
      values[rowIndex] || [];

    if (headerIsUsable(row)) {
      return {
        rowIndex,
        headers: row
      };
    }
  }

  return null;
}

function headerMap(headers) {
  const map = {};

  for (
    let columnIndex = 0;
    columnIndex < headers.length;
    columnIndex++
  ) {
    const field =
      fieldFromHeader(
        headers[columnIndex]
      );

    if (
      field &&
      map[field] === undefined
    ) {
      map[field] =
        columnIndex;
    }
  }

  return map;
}

function rowToObject(
  values,
  rowIndex,
  headerInfo
) {
  const row =
    values[rowIndex] || [];

  const map =
    headerMap(
      headerInfo.headers
    );

  const result = {};

  for (
    const field in map
  ) {
    const columnIndex =
      map[field];

    result[field] =
      row[columnIndex] == null
        ? ""
        : row[columnIndex];
  }

  result.nickname =
    String(
      result.nickname || ""
    ).trim();

  result.row_number =
    rowIndex + 1;

  result.headers =
    headerInfo.headers;

  result.raw_row =
    row;

  return result;
}

function findAdminPosition(
  values,
  nickname,
  headerInfo
) {
  const target =
    normalize(nickname);

  if (!target) {
    throw new Error(
      "NICKNAME_REQUIRED"
    );
  }

  const info =
    headerInfo ||
    findHeaderInfo(values);

  if (!info) {
    throw new Error(
      "HEADERS_NOT_FOUND"
    );
  }

  const map =
    headerMap(
      info.headers
    );

  const nicknameColumn =
    map.nickname;

  if (
    nicknameColumn ===
    undefined
  ) {
    throw new Error(
      "HEADERS_NOT_FOUND"
    );
  }

  for (
    let rowIndex =
      info.rowIndex + 1;
    rowIndex < values.length;
    rowIndex++
  ) {
    const cell =
      values[rowIndex]
        ? values[rowIndex][
            nicknameColumn
          ]
        : "";

    if (
      normalize(cell) ===
      target
    ) {
      return {
        rowIndex,
        headerInfo: info
      };
    }
  }

  throw new Error(
    "STATISTICS_NOT_FOUND"
  );
}

function getAdmin(
  nickname,
  sheetName
) {
  const sheet =
    getSheet(sheetName);

  const values =
    getDisplayValues(sheet);

  const headerInfo =
    findHeaderInfo(values);

  const found =
    findAdminPosition(
      values,
      nickname,
      headerInfo
    );

  const admin =
    rowToObject(
      values,
      found.rowIndex,
      found.headerInfo
    );

  return {
    success: true,
    sheet_name:
      sheet.getName(),
    row_number:
      found.rowIndex + 1,
    admin
  };
}

function getRow(
  rowNumber,
  sheetName
) {
  const sheet =
    getSheet(sheetName);

  const rowNumberValue =
    Number(rowNumber);

  if (
    !Number.isInteger(
      rowNumberValue
    ) ||
    rowNumberValue < 1 ||
    rowNumberValue >
      sheet.getMaxRows()
  ) {
    throw new Error(
      "ROW_NUMBER_INVALID"
    );
  }

  const values =
    getDisplayValues(sheet);

  const headerInfo =
    findHeaderInfo(values);

  if (!headerInfo) {
    throw new Error(
      "HEADERS_NOT_FOUND"
    );
  }

  return {
    success: true,
    sheet_name:
      sheet.getName(),
    row_number:
      rowNumberValue,
    row:
      rowToObject(
        values,
        rowNumberValue - 1,
        headerInfo
      )
  };
}

function getAllAdmins(
  sheetName
) {
  const sheet =
    getSheet(sheetName);

  const values =
    getDisplayValues(sheet);

  const headerInfo =
    findHeaderInfo(values);

  if (!headerInfo) {
    throw new Error(
      "HEADERS_NOT_FOUND"
    );
  }

  const map =
    headerMap(
      headerInfo.headers
    );

  const nicknameColumn =
    map.nickname;

  if (
    nicknameColumn ===
    undefined
  ) {
    throw new Error(
      "HEADERS_NOT_FOUND"
    );
  }

  const statistics = [];

  for (
    let rowIndex =
      headerInfo.rowIndex + 1;
    rowIndex < values.length;
    rowIndex++
  ) {
    const nickname =
      String(
        values[rowIndex][
          nicknameColumn
        ] || ""
      ).trim();

    if (!nickname) {
      continue;
    }

    const valuesObject =
      rowToObject(
        values,
        rowIndex,
        headerInfo
      );

    statistics.push({
      row_number:
        rowIndex + 1,
      values:
        valuesObject
    });
  }

  return {
    success: true,
    sheet_name:
      sheet.getName(),
    statistics
  };
}

function updateAdmin(
  nickname,
  changes,
  sheetName
) {
  const sheet =
    getSheet(sheetName);

  const values =
    getDisplayValues(sheet);

  const headerInfo =
    findHeaderInfo(values);

  const found =
    findAdminPosition(
      values,
      nickname,
      headerInfo
    );

  return updateFoundRow(
    sheet,
    found.rowIndex,
    found.headerInfo,
    changes
  );
}

function updateRow(
  rowNumber,
  changes,
  sheetName
) {
  const sheet =
    getSheet(sheetName);

  const rowNumberValue =
    Number(rowNumber);

  if (
    !Number.isInteger(
      rowNumberValue
    ) ||
    rowNumberValue < 1 ||
    rowNumberValue >
      sheet.getMaxRows()
  ) {
    throw new Error(
      "ROW_NUMBER_INVALID"
    );
  }

  const values =
    getDisplayValues(sheet);

  const headerInfo =
    findHeaderInfo(values);

  if (!headerInfo) {
    throw new Error(
      "HEADERS_NOT_FOUND"
    );
  }

  return updateFoundRow(
    sheet,
    rowNumberValue - 1,
    headerInfo,
    changes
  );
}

function updateFoundRow(
  sheet,
  rowIndex,
  headerInfo,
  changes
) {
  if (
    !changes ||
    typeof changes !==
      "object" ||
    Array.isArray(changes)
  ) {
    throw new Error(
      "CHANGES_REQUIRED"
    );
  }

  const entries =
    Object.entries(changes);

  if (!entries.length) {
    throw new Error(
      "CHANGES_REQUIRED"
    );
  }

  const map =
    headerMap(
      headerInfo.headers
    );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const updatedFields = [];

    for (
      const [requestedField, value]
      of entries
    ) {
      const field =
        resolveField(
          requestedField
        );

      if (!field) {
        throw new Error(
          "FIELD_NOT_ALLOWED"
        );
      }

      const columnIndex =
        map[field];

      if (
        columnIndex ===
        undefined
      ) {
        throw new Error(
          "FIELD_NOT_FOUND"
        );
      }

      sheet
        .getRange(
          rowIndex + 1,
          columnIndex + 1
        )
        .setValue(value);

      updatedFields.push({
        field,
        column:
          columnIndex + 1
      });
    }

    SpreadsheetApp.flush();

    return {
      success: true,
      sheet_name:
        sheet.getName(),
      row_number:
        rowIndex + 1,
      updated:
        updatedFields
    };
  } finally {
    lock.releaseLock();
  }
}

function appendAdmin(
  valuesObject,
  sheetName
) {
  if (
    !valuesObject ||
    typeof valuesObject !==
      "object" ||
    Array.isArray(valuesObject)
  ) {
    throw new Error(
      "VALUES_REQUIRED"
    );
  }

  const sheet =
    getSheet(sheetName);

  const values =
    getDisplayValues(sheet);

  const headerInfo =
    findHeaderInfo(values);

  if (!headerInfo) {
    throw new Error(
      "HEADERS_NOT_FOUND"
    );
  }

  const map =
    headerMap(
      headerInfo.headers
    );

  const row =
    Array(
      headerInfo.headers.length
    ).fill("");

  for (
    const [requestedField, value]
    of Object.entries(valuesObject)
  ) {
    const field =
      resolveField(
        requestedField
      );

    if (!field) {
      throw new Error(
        "FIELD_NOT_ALLOWED"
      );
    }

    const columnIndex =
      map[field];

    if (
      columnIndex ===
      undefined
    ) {
      throw new Error(
        "FIELD_NOT_FOUND"
      );
    }

    row[columnIndex] =
      value;
  }

  const nicknameColumn =
    map.nickname;

  if (
    nicknameColumn ===
      undefined ||
    !String(
      row[nicknameColumn] || ""
    ).trim()
  ) {
    throw new Error(
      "NICKNAME_REQUIRED"
    );
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const targetRow =
      Math.max(
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
      sheet_name:
        sheet.getName(),
      row_number:
        targetRow,
      row
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
    EMPTY_REQUEST:
      "Пустой запрос",
    INVALID_JSON:
      "Некорректный JSON",
    SCRIPT_SECRET_NOT_CONFIGURED:
      "Не настроен секрет Apps Script",
    UNAUTHORIZED:
      "Недействительный секрет",
    SPREADSHEET_NOT_FOUND:
      "Таблица не найдена",
    SPREADSHEET_NOT_INITIALIZED:
      "Apps Script ещё не привязан к таблице",
    SHEET_NOT_FOUND:
      "Лист не найден",
    HEADERS_NOT_FOUND:
      "Не найдены заголовки администрации",
    NICKNAME_REQUIRED:
      "Не передан никнейм",
    STATISTICS_NOT_FOUND:
      "Администратор не найден в таблице",
    ROW_NUMBER_INVALID:
      "Некорректный номер строки",
    CHANGES_REQUIRED:
      "Не переданы изменения",
    FIELD_NOT_ALLOWED:
      "Недопустимое поле",
    FIELD_NOT_FOUND:
      "Нужное поле отсутствует в таблице",
    VALUES_REQUIRED:
      "Не переданы данные",
    UNKNOWN_ACTION:
      "Неизвестное действие",
    INTERNAL_ERROR:
      "Внутренняя ошибка"
  };

  return (
    messages[code] ||
    "Внутренняя ошибка"
  );
}
