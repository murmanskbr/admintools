# Black Russia — Мурманск AdminTools

Публичный frontend панели администрации.

## Архитектура

Проект сделан как многостраничный frontend: каждый раздел панели имеет собственный HTML-адрес и загружается независимо.

Общий код не дублируется:
- `js/core.js` — сессия, авторизация, общий layout и меню;
- `js/api.js` — frontend-клиент API;
- `js/page.js` — логика страниц и их представлений;
- `css/app-v11.css` — единый UI-слой.

## Страницы

- `index.html` — авторизация;
- `pages/dashboard.html` — главная;
- `pages/profile.html` — мой профиль;
- `pages/admins.html` — состав администрации;
- `pages/statistics.html` — моя статистика;
- `pages/statistics-all.html` — статистика администрации;
- `pages/notifications.html` — уведомления;
- `pages/normatives.html` — мои нормативы;
- `pages/normatives-all.html` — нормативы администрации;
- `pages/requests.html` — мои обращения;
- `pages/requests-all.html` — обращения администрации;
- `pages/logs.html` — журнал действий;
- `pages/rules.html` — регламент;
- `pages/access.html` — управление доступом.

## Backend

Репозиторий содержит только frontend. Supabase Edge Functions, Google Apps Script и секреты в GitHub не хранятся.

Frontend обращается к backend через `js/api.js`.

## Поддержка

Структура подготовлена для дальнейшего расширения: новые разделы добавляются отдельной HTML-страницей и подключают общий core/API без изменения остальных страниц.
