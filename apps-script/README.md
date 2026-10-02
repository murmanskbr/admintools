# Google Apps Script bridge

Открой Google-таблицу статистики и выбери Extensions → Apps Script.

Вставь содержимое Code.gs в редактор Apps Script.

В Project Settings → Script properties создай:

SCRIPT_SECRET = тот же секрет, который будет сохранён в Supabase как GOOGLE_SCRIPT_SECRET.

После сохранения запусти функцию setupSpreadsheet один раз из редактора и подтверди доступ. Это автоматически сохранит привязку к текущей таблице. Получать или вводить spreadsheet ID вручную не требуется.

Затем Deploy → New deployment → Web app.

Execute as: Me.

Who has access: Anyone.

Скопируй URL развёрнутого web app.

В Supabase → Edge Functions → Secrets для проекта frwajpwzurzokkvhntdl создай:

GOOGLE_SCRIPT_URL = URL веб-приложения Apps Script
GOOGLE_SCRIPT_SECRET = тот же секрет, что и SCRIPT_SECRET в Apps Script

После этого модуль statistics использует только Apps Script. Google Service Account для чтения/записи этой таблицы больше не нужен.

Поддерживаемые действия:

health
get_admin { nickname }
get_row { row_number, sheet_name? }
get_all_admins { sheet_name? }
update_admin { nickname, changes, sheet_name? }
update_row { row_number, changes, sheet_name? }
append_admin { values, sheet_name? }

Доступные поля:

nickname
age
pc_access
position
levels
activity_points
inactives
strikes
warnings
points
last_promotion

Для update_admin пример запроса:

{
  "action": "update_admin",
  "nickname": "Nikita Zvezda",
  "changes": {
    "points": 350,
    "warnings": 1,
    "last_promotion": "2026-10-02"
  }
}
