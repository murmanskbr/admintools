# Google Apps Script bridge

Этот bridge запускается из той же Google-таблицы, которую использует администрация.

## Установка

Открой Google-таблицу → **Расширения → Apps Script**.

Вставь содержимое `Code.gs` из этого каталога и сохрани проект.

## Первичная настройка

Запусти функцию `setupSpreadsheet` один раз.

После выдачи разрешений функция сохранит ID таблицы и имя подходящего листа в Script Properties.

Сначала проверяется лист `admins`, затем остальные листы. Заголовок определяется автоматически по известным полям, в первую очередь по колонке никнейма.

Если `SCRIPT_SECRET` ещё не существует, функция создаст новый случайный секрет. Его можно увидеть только в Execution log Apps Script.

**Секрет не должен находиться в GitHub.**

## Web app

Создай Deploy → New deployment → Web app.

Параметры:

- Execute as: **Me**
- Who has access: **Anyone**

Используй актуальный URL deployment с окончанием `/exec`.

После изменения кода создай новую версию deployment.

## Supabase

В Edge Functions → Secrets проекта `frwajpwzurzokkvhntdl` задай:

`GOOGLE_SCRIPT_URL` — URL Web App Apps Script

`GOOGLE_SCRIPT_SECRET` — значение `SCRIPT_SECRET` из Script Properties

Модуль статистики включается автоматически, когда оба значения доступны. Для ручного отключения можно задать `STATISTICS_ENABLED=false`.

## Диагностика

GET-запрос к URL Apps Script должен вернуть:

`success: true`, `service: "br-admin-tools"`, `status: "ok"`.

Для подробной диагностики отправляется действие `diagnostics` с правильным секретом. Оно показывает названия листов, размер данных и найденную строку заголовков, но не раскрывает секрет.

Поддерживаемые действия:

- `health`
- `diagnostics`
- `get_admin`
- `get_row`
- `get_all_admins`
- `update_admin`
- `update_row`
- `append_admin`

Поддерживаемые поля:

- `nickname`
- `age`
- `pc_access`
- `position`
- `levels`
- `activity_points`
- `inactives`
- `strikes`
- `warnings`
- `points`
- `last_promotion`
