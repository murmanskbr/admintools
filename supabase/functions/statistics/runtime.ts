import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
    Deno.env.get("SUPABASE_URL") ?? "";

const DB_SECRET_KEY =
    Deno.env.get("DB_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";

const IDLE_TIMEOUT_SECONDS = 180;

async function getGoogleScriptConfig(): Promise<string> {
    const { data, error } = await db()
        .from("google_script_config")
        .select("web_app_url")
        .eq("id", 1)
        .maybeSingle();

    if (error) {
        console.error(
            "STATISTICS GOOGLE CONFIG ERROR",
            error
        );
        throw new Error(
            "DATABASE_ERROR"
        );
    }

    return String(
        data?.web_app_url ?? ""
    ).trim();
}

async function getGoogleScriptSecrets(): Promise<string[]> {
    const secrets: string[] = [];

    const envSecret =
        String(
            Deno.env.get(
                "GOOGLE_SCRIPT_SECRET"
            ) ?? ""
        ).trim();

    if (envSecret) {
        secrets.push(envSecret);
    }

    // Keep the database secret as a fallback. This is especially important when
    // GOOGLE_SCRIPT_SECRET in the Edge Function is stale after the shared secret
    // was rotated in the Google Apps Script.
    try {
        const { data, error } =
            await db().rpc(
                "get_google_script_secret"
            );

        if (!error && data) {
            const databaseSecret =
                String(data).trim();

            if (
                databaseSecret &&
                secrets.indexOf(databaseSecret) === -1
            ) {
                secrets.push(databaseSecret);
            }
        }

        if (error) {
            console.error(
                "STATISTICS GOOGLE SECRET ERROR",
                error
            );
        }
    } catch (error) {
        console.error(
            "STATISTICS GOOGLE SECRET ERROR",
            error
        );
    }

    if (!secrets.length) {
        throw new Error(
            "APPS_SCRIPT_SECRET_NOT_CONFIGURED"
        );
    }

    return secrets;
}

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-device-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400"
};

function response(
    data: unknown,
    status = 200
): Response {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                ...corsHeaders,
                "Content-Type":
                    "application/json; charset=utf-8"
            }
        }
    );
}

function fail(
    code: string,
    status: number,
    message: string
): Response {
    return response(
        {
            success: false,
            code,
            message
        },
        status
    );
}

function db() {
    if (
        !SUPABASE_URL ||
        !DB_SECRET_KEY
    ) {
        throw new Error(
            "SERVER_CONFIGURATION_ERROR"
        );
    }

    return createClient(
        SUPABASE_URL,
        DB_SECRET_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );
}

async function sha256(
    value: string
): Promise<string> {
    const buffer =
        await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(value)
        );

    return Array.from(
        new Uint8Array(buffer)
    )
        .map(item =>
            item
                .toString(16)
                .padStart(2, "0")
        )
        .join("");
}

async function authenticatedSession(
    request: Request
) {
    const authorization =
        request.headers.get(
            "authorization"
        ) ?? "";

    const match =
        authorization.match(
            /^Bearer\s+(.+)$/i
        );

    if (!match) {
        throw new Error(
            "UNAUTHORIZED"
        );
    }

    const rawToken =
        match[1].trim();

    if (!rawToken) {
        throw new Error(
            "UNAUTHORIZED"
        );
    }

    const tokenHash =
        await sha256(rawToken);

    const { data: session, error } =
        await db()
            .from("admin_sessions")
            .select(
                "id,admin_id,device_id,expires_at,last_activity_at,revoked_at"
            )
            .eq(
                "token_hash",
                tokenHash
            )
            .is(
                "revoked_at",
                null
            )
            .maybeSingle();

    if (error) {
        console.error(
            "STATISTICS SESSION ERROR",
            error
        );
        throw new Error(
            "SESSION_DATABASE_ERROR"
        );
    }

    if (!session) {
        throw new Error(
            "UNAUTHORIZED"
        );
    }

    const now =
        Date.now();

    const expiresAt =
        new Date(
            session.expires_at
        ).getTime();

    if (
        !Number.isFinite(expiresAt) ||
        expiresAt <= now
    ) {
        await db()
            .from("admin_sessions")
            .update({
                revoked_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                session.id
            );

        throw new Error(
            "SESSION_EXPIRED"
        );
    }

    const lastActivity =
        session.last_activity_at
            ? new Date(
                session.last_activity_at
            ).getTime()
            : now;

    if (
        Number.isFinite(lastActivity) &&
        now - lastActivity >
            IDLE_TIMEOUT_SECONDS * 1000
    ) {
        await db()
            .from("admin_sessions")
            .update({
                revoked_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                session.id
            );

        throw new Error(
            "SESSION_IDLE_EXPIRED"
        );
    }

    const requestDeviceId =
        request.headers
            .get("x-device-id")
            ?.trim() ?? "";

    if (
        session.device_id &&
        requestDeviceId
    ) {
        const requestDeviceHash =
            await sha256(
                requestDeviceId
            );

        if (
            requestDeviceHash !==
            session.device_id
        ) {
            throw new Error(
                "DEVICE_MISMATCH"
            );
        }
    }

    const { data: admin, error: adminError } =
        await db()
            .from("admins")
            .select(
                "id,login,nickname,role,position,is_active"
            )
            .eq(
                "id",
                session.admin_id
            )
            .maybeSingle();

    if (adminError) {
        console.error(
            "STATISTICS ADMIN ERROR",
            adminError
        );
        throw new Error(
            "ADMIN_DATABASE_ERROR"
        );
    }

    if (!admin) {
        throw new Error(
            "ADMIN_NOT_FOUND"
        );
    }

    if (!admin.is_active) {
        throw new Error(
            "ACCOUNT_INACTIVE"
        );
    }

    const { error: activityError } =
        await db()
            .from("admin_sessions")
            .update({
                last_activity_at:
                    new Date()
                        .toISOString()
            })
            .eq(
                "id",
                session.id
            );

    if (activityError) {
        console.error(
            "STATISTICS SESSION ACTIVITY ERROR",
            activityError
        );
    }

    return {
        admin,
        session
    };
}

async function appsScript(
    action: string,
    payload: Record<string, unknown> = {}
): Promise<any> {
    const scriptUrl = await getGoogleScriptConfig();
    if (!scriptUrl) throw new Error("APPS_SCRIPT_NOT_CONFIGURED");

    const secrets = await getGoogleScriptSecrets();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    try {
        let lastError: Error | null = null;
        for (let i = 0; i < secrets.length; i += 1) {
            try {
                const upstream = await fetch(scriptUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json, text/plain, */*"
                    },
                    body: JSON.stringify({
                        secret: secrets[i],
                        action,
                        ...payload
                    }),
                    signal: controller.signal,
                    redirect: "follow",
                    cache: "no-store"
                });

                const raw = await upstream.text();
                let data: any = null;

                try {
                    data = raw ? JSON.parse(raw) : null;
                } catch {
                    console.error(
                        "STATISTICS GOOGLE INVALID RESPONSE",
                        {
                            status: upstream.status,
                            content_type:
                                upstream.headers.get("content-type") ?? "",
                            action
                        }
                    );
                    throw new Error("GOOGLE_SCRIPT_INVALID_RESPONSE");
                }

                if (!upstream.ok || !data || data.success === false) {
                    const code = String(data?.code ?? "").trim();
                    console.error(
                        "STATISTICS APPS SCRIPT ERROR",
                        {
                            status: upstream.status,
                            code,
                            action
                        }
                    );

                    if (code === "UNAUTHORIZED") {
                        throw new Error("APPS_SCRIPT_UNAUTHORIZED");
                    }

                    throw new Error(code || "GOOGLE_SCRIPT_ERROR");
                }

                if (i > 0) {
                    console.warn("STATISTICS GOOGLE SECRET FALLBACK USED");
                }

                return data;
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.name === "AbortError"
                ) {
                    throw error;
                }

                const normalized =
                    error instanceof Error
                        ? error
                        : new Error("GOOGLE_SCRIPT_ERROR");

                lastError = normalized;

                if (
                    (
                        normalized.message === "APPS_SCRIPT_UNAUTHORIZED" ||
                        normalized.message === "GOOGLE_SCRIPT_INVALID_RESPONSE"
                    ) &&
                    i + 1 < secrets.length
                ) {
                    continue;
                }

                throw normalized;
            }
        }

        throw lastError ?? new Error("APPS_SCRIPT_UNAUTHORIZED");
    } catch (error) {
        if (
            error instanceof Error &&
            error.name === "AbortError"
        ) {
            throw new Error("GOOGLE_SCRIPT_TIMEOUT");
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
type GoogleSheetSnapshot = {
    name?: string;
    index?: number;
    header_row?: number | null;
    headers?: unknown[];
    rows?: unknown[][];
    row_count?: number;
    column_count?: number;
};

function googleStatisticsSheet(result: any): GoogleSheetSnapshot | null {
    const value = result?.statistics;
    return value &&
        typeof value === "object" &&
        !Array.isArray(value)
        ? value as GoogleSheetSnapshot
        : null;
}

function googleHeaders(sheet: GoogleSheetSnapshot | null): string[] {
    return Array.isArray(sheet?.headers)
        ? sheet.headers.map((value) => String(value ?? "").trim())
        : [];
}

function googleHeaderMatches(header: unknown, aliases: string[]): boolean {
    const value = String(header ?? "")
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[_\-]+/g, " ")
        .replace(/\s+/g, " ");

    return aliases.some((alias) =>
        value === alias.trim().toLowerCase()
            .replace(/ё/g, "е")
            .replace(/[_\-]+/g, " ")
            .replace(/\s+/g, " ")
    );
}

function googleNicknameColumn(headers: unknown[]): number {
    return headers.findIndex((header) =>
        googleHeaderMatches(header, [
            "никнейм", "ник", "nickname", "nick",
            "логин", "login", "username"
        ])
    );
}

function googleStatisticsItems(result: any) {
    const sheet = googleStatisticsSheet(result);
    if (!sheet) return [];

    const headers = googleHeaders(sheet);
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const headerRow = Number(sheet.header_row);

    if (
        !headers.length ||
        !rows.length ||
        !Number.isInteger(headerRow) ||
        headerRow < 1
    ) {
        return [];
    }

    const items: Array<any> = [];

    for (let i = headerRow; i < rows.length; i += 1) {
        const raw = Array.isArray(rows[i]) ? rows[i] : [];

        if (
            !raw.some(
                (value) =>
                    String(value ?? "").trim() !== ""
            )
        ) {
            continue;
        }

        items.push({
            row_number: i + 1,
            sheet_name: String(sheet.name ?? ""),
            values: {
                headers: headers.slice(),
                raw_row: raw.slice()
            }
        });
    }

    return items;
}

function googleFindStatisticsItem(result: any, nickname: string) {
    const items = googleStatisticsItems(result);
    const headers = items[0]?.values?.headers ?? [];
    const nicknameIndex = googleNicknameColumn(headers);

    if (nicknameIndex < 0) return null;

    const target = nickname.trim().toLowerCase();

    return items.find(
        (item) =>
            String(item.values.raw_row[nicknameIndex] ?? "")
                .trim()
                .toLowerCase() === target
    ) ?? null;
}

function googlePublicStatistics(result: any) {
    const sheet = googleStatisticsSheet(result);
    const items = googleStatisticsItems(result);

    return {
        success: true,
        source: {
            type: "google_apps_script",
            sheet_name: sheet?.name ?? null,
            header_row: sheet?.header_row ?? null
        },
        spreadsheet: {
            id: result?.spreadsheet_id ?? null,
            name: result?.spreadsheet_name ?? null,
            timezone: result?.timezone ?? null
        },
        headers: googleHeaders(sheet),
        rows: items.map((item) => item.values.raw_row),
        row_numbers: items.map((item) => item.row_number),
        statistics: items,
        normatives: result?.normatives ?? null,
        sheets: Array.isArray(result?.sheets)
            ? result.sheets
            : []
    };
}

async function myStatistics(
    request: Request,
    requestedNickname?: string
) {
    const { admin } = await authenticatedSession(request);
    const nickname = String(
        requestedNickname ?? admin.nickname ?? ""
    ).trim();

    if (!nickname) throw new Error("NICKNAME_REQUIRED");

    if (
        admin.role !== "management" &&
        nickname.toLowerCase() !==
            String(admin.nickname ?? "").trim().toLowerCase()
    ) {
        throw new Error("FORBIDDEN");
    }

    const result = await appsScript("get");
    const item = googleFindStatisticsItem(result, nickname);

    if (!item) throw new Error("STATISTICS_NOT_FOUND");

    return {
        success: true,
        admin: {
            id: admin.id,
            login: admin.login,
            nickname: admin.nickname,
            role: admin.role,
            position: admin.position
        },
        source: {
            type: "google_apps_script",
            sheet_name: item.sheet_name
        },
        statistics: {
            row_number: item.row_number,
            sheet_name: item.sheet_name,
            values: item.values,
            headers: item.values.headers,
            raw_row: item.values.raw_row
        }
    };
}

async function allStatistics(
    request: Request
) {
    const { admin } = await authenticatedSession(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    return googlePublicStatistics(
        await appsScript("get")
    );
}

async function updateAdmin(
    request: Request,
    body: any
) {
    const { admin } = await authenticatedSession(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    const nickname = String(body?.nickname ?? "").trim();

    const changes =
        body?.changes &&
        typeof body.changes === "object" &&
        !Array.isArray(body.changes)
            ? body.changes
            : null;

    if (!nickname) throw new Error("NICKNAME_REQUIRED");
    if (!changes) throw new Error("CHANGES_REQUIRED");

    const entries = Object.entries(changes).filter(
        ([field]) => String(field).trim() !== ""
    );

    if (!entries.length) throw new Error("CHANGES_REQUIRED");
    if (entries.length > 100) throw new Error("TOO_MANY_FIELDS");

    const snapshot = await appsScript("get");
    const item = googleFindStatisticsItem(snapshot, nickname);

    if (!item) throw new Error("STATISTICS_NOT_FOUND");

    const realHeaders = item.values.headers.map(
        (header: unknown) => String(header ?? "").trim().toLowerCase()
    );

    for (const [field] of entries) {
        if (
            realHeaders.indexOf(
                String(field).trim().toLowerCase()
            ) < 0
        ) {
            throw new Error("FIELD_NOT_FOUND");
        }
    }

    const requestId =
        String(body?._client_request_id ?? "").trim();

    let result: any;

    try {
        result = await appsScript(
            "update_existing_fields",
            {
                nickname,
                sheet_name: item.sheet_name,
                changes: Object.fromEntries(entries),
                request_id: requestId || undefined
            }
        );
    } catch (error) {
        if (
            !(
                error instanceof Error &&
                error.message === "UNKNOWN_ACTION"
            )
        ) {
            throw error;
        }

        for (const [field, value] of entries) {
            result = await appsScript(
                "update_existing_field",
                {
                    nickname,
                    sheet_name: item.sheet_name,
                    field,
                    value,
                    request_id: requestId || undefined
                }
            );
        }

        result = await appsScript("get");
    }

    return googlePublicStatistics(result);
}

async function updateRow(
    request: Request,
    body: any
) {
    const { admin } = await authenticatedSession(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    const rowNumber = Number(body?.row_number);
    if (!Number.isInteger(rowNumber) || rowNumber <= 0) {
        throw new Error("ROW_NUMBER_INVALID");
    }

    const snapshot = await appsScript("get");
    const item =
        googleStatisticsItems(snapshot).find(
            (candidate) =>
                Number(candidate.row_number) === rowNumber
        );

    if (!item) throw new Error("GOOGLE_ROW_NOT_FOUND");

    const nicknameIndex =
        googleNicknameColumn(item.values.headers);

    if (nicknameIndex < 0) {
        throw new Error("FIELD_NOT_FOUND");
    }

    const nickname =
        String(item.values.raw_row[nicknameIndex] ?? "").trim();

    if (!nickname) throw new Error("NICKNAME_REQUIRED");

    return updateAdmin(request, {
        nickname,
        changes: body?.changes,
        _client_request_id: body?._client_request_id
    });
}

async function appendAdmin(
    request: Request,
    _body: any
) {
    await authenticatedSession(request);
    throw new Error("APPEND_NOT_SUPPORTED_BY_BRIDGE");
}

async function getRow(
    request: Request,
    body: any
) {
    const { admin } = await authenticatedSession(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    const rowNumber = Number(body?.row_number);
    if (!Number.isInteger(rowNumber) || rowNumber <= 0) {
        throw new Error("ROW_NUMBER_INVALID");
    }

    const snapshot = await appsScript("get");
    const item =
        googleStatisticsItems(snapshot).find(
            (candidate) =>
                Number(candidate.row_number) === rowNumber
        );

    if (!item) throw new Error("GOOGLE_ROW_NOT_FOUND");

    return {
        success: true,
        row_number: item.row_number,
        sheet_name: item.sheet_name,
        admin: {
            headers: item.values.headers,
            raw_row: item.values.raw_row,
            row_number: item.row_number
        }
    };
}

async function getAdmin(
    request: Request,
    body: any
) {
    return myStatistics(
        request,
        String(body?.nickname ?? "").trim() || undefined
    );
}

async function normativeMark(
    request: Request,
    body: any
) {
    const { admin } = await authenticatedSession(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    const nickname = String(body?.nickname ?? "").trim();
    const date = String(body?.date ?? "").trim();
    const status = String(body?.status ?? "").trim();

    if (!nickname) throw new Error("NORMATIVE_NICKNAME_REQUIRED");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("NORMATIVE_DATE_REQUIRED");
    }

    if (
        ["norm", "rework", "inactive", "no_norm"].indexOf(status) < 0
    ) {
        throw new Error("NORMATIVE_MARK_STATUS_REQUIRED");
    }

    const result = await appsScript("normative_mark", {
        nickname,
        date,
        status,
        review_comment:
            String(body?.review_comment ?? "").trim(),
        request_id:
            String(body?._client_request_id ?? "").trim() ||
            undefined
    });

    return {
        google_sheet: result,
        ...googlePublicStatistics(result)
    };
}

async function route(
    request: Request
) {
    const body =
        await request.json().catch(() => ({}));

    const action =
        String(body?.action ?? "").trim();

    switch (action) {
        case "my_statistics":
            return myStatistics(request);

        case "get_admin":
            return getAdmin(request, body);

        case "all_statistics":
        case "admins_google_list":
            return allStatistics(request);

        case "update_admin":
            return updateAdmin(request, body);

        case "normative_mark":
            return normativeMark(request, body);

        case "update_row":
            return updateRow(request, body);

        case "append_admin":
            return appendAdmin(request, body);

        case "get_row":
            return getRow(request, body);

        case "health":
            return {
                success: true,
                service: "statistics",
                bridge_action: "get"
            };

        default:
            throw new Error("UNKNOWN_ACTION");
    }
}

const errors: Record<
    string,
    [number, string]
> = {
    SERVER_CONFIGURATION_ERROR:
        [500, "Ошибка конфигурации сервера"],

    DATABASE_ERROR:
        [500, "Ошибка базы данных"],

    APPS_SCRIPT_NOT_CONFIGURED:
        [503, "Google Apps Script не настроен"],

    APPS_SCRIPT_SECRET_NOT_CONFIGURED:
        [502, "Секрет Google Apps Script не настроен"],

    APPS_SCRIPT_UNAUTHORIZED:
        [502, "Google Apps Script отклонил запрос: секреты не совпадают"],

    GOOGLE_SCRIPT_ERROR:
        [502, "Apps Script вернул ошибку"],

    GOOGLE_SCRIPT_INVALID_RESPONSE:
        [502, "Apps Script вернул некорректный ответ"],

    GOOGLE_SCRIPT_TIMEOUT:
        [504, "Apps Script не ответил вовремя"],

    UNAUTHORIZED:
        [401, "Авторизация не пройдена"],

    SESSION_EXPIRED:
        [401, "Сессия истекла"],

    SESSION_IDLE_EXPIRED:
        [401, "Сессия завершена из-за бездействия"],

    SESSION_DATABASE_ERROR:
        [500, "Ошибка проверки сессии"],

    ACCOUNT_INACTIVE:
        [403, "Аккаунт не активирован"],

    ADMIN_DATABASE_ERROR:
        [500, "Ошибка базы администраторов"],

    ADMIN_NOT_FOUND:
        [404, "Администратор не найден"],

    DEVICE_MISMATCH:
        [403, "Аккаунт уже привязан к другому устройству"],

    FORBIDDEN:
        [403, "Недостаточно прав"],

    UNKNOWN_ACTION:
        [400, "Неизвестное действие"],

    NICKNAME_REQUIRED:
        [400, "Не передан никнейм"],

    ROW_NUMBER_INVALID:
        [400, "Некорректный номер строки"],

    CHANGES_REQUIRED:
        [400, "Не переданы изменения"],

    FIELD_NOT_ALLOWED:
        [400, "Недопустимое поле"],

    FIELD_NOT_FOUND:
        [400, "Нужное поле отсутствует в таблице"],

    VALUES_REQUIRED:
        [400, "Не переданы данные"],

    STATISTICS_NOT_FOUND:
        [404, "Администратор не найден в таблице"]
};

Deno.serve(
    async (
        request: Request
    ) => {
        if (
            request.method ===
            "OPTIONS"
        ) {
            return new Response(
                "ok",
                {
                    status: 200,
                    headers:
                        corsHeaders
                }
            );
        }

        if (
            request.method !==
            "POST"
        ) {
            return fail(
                "METHOD_NOT_ALLOWED",
                405,
                "Разрешён только POST"
            );
        }

        try {
            return response(
                await route(
                    request
                )
            );
        } catch (
            error
        ) {
            const code =
                error instanceof
                Error
                    ? error.message
                    : "INTERNAL_ERROR";

            const item =
                errors[code];

            if (item) {
                return fail(
                    code,
                    item[0],
                    item[1]
                );
            }

            console.error(
                "STATISTICS ERROR",
                error
            );

            return fail(
                "INTERNAL_ERROR",
                500,
                "Внутренняя ошибка сервера"
            );
        }
    }
);
