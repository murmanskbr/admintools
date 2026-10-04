# Google Sheets Bridge

Google Sheets is the source of truth for administration statistics and normative marks. Supabase keeps authentication, sessions, permissions and application workflow data.

## Bridge actions

### get
Returns the complete workbook snapshot. The response contains the detected `statistics` sheet, the detected `normatives` sheet when available, and `sheets` with the raw workbook matrices.

### normative_mark
Payload: nickname, date (YYYY-MM-DD), status (`norm`, `rework`, `inactive`, `no_norm`), optional review_comment and request_id.

Semantics:
- `norm`: write `Норма` and increment the existing `Дни на посту` field.
- `rework`: write `Перенорма` and increment the existing `Дни на посту` field.
- `inactive`: write `Неактив` and increment the existing `Неактивы` counter without exceeding its detected total.
- `no_norm`: increment the existing `Страйки` field only; the normative cell is not changed.

### update_existing_field
Changes one already-existing column in the row identified by nickname.

### update_existing_fields
Changes multiple already-existing columns in one locked bridge operation. No new columns or rows are created.

## Frontend contract

The web client does not invent statistics columns or synthetic values. It renders the headers and raw row values returned by the bridge. The edit form is generated from the headers actually returned for the selected row and submits only changed, existing fields.

After a write the bridge rereads the workbook and returns fresh data. The frontend renders that returned state rather than calculating replacement counters locally.

## Security

The shared Apps Script secret must never be committed to this repository. The deployed Edge Functions retrieve it from Supabase secrets/Vault and never expose it to the browser.
