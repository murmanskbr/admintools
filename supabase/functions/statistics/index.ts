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
) {
    const scriptUrl =
        await getGoogleScriptConfig();

    const scriptSecrets =
        await getGoogleScriptSecrets();

    if (!scriptUrl) {
        throw new Error(
            "APPS_SCRIPT_NOT_CONFIGURED"
        );
    }

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            50000
        );

    try {
        let lastError:
            Error | null = null;

        for (
            let secretIndex = 0;
            secretIndex < scriptSecrets.length;
            secretIndex += 1
        ) {
            const scriptSecret =
                scriptSecrets[secretIndex];

            try {
                const upstream =
                    await fetch(
                        scriptUrl,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json",
                                "Accept":
                                    "application/json"
                            },
                            body:
                                JSON.stringify({
                                    secret:
                                        scriptSecret,
                                    action,
                                    ...payload
                                }),
                            signal: controller.signal,
                            redirect: "follow"
                        }
                    );

                const raw =
                    await upstream.text();

                let data:
                    any = null;

                try {
                    data = raw
                        ? JSON.parse(raw)
                        : null;
                } catch {
                    // A stale/invalid Apps Script secret may return an HTML or
                    // plain-text response instead of the JSON API payload.
                    // Log only safe metadata, never the secret itself.
                    console.error(
                        "STATISTICS GOOGLE INVALID RESPONSE",
                        {
                            status:
                                upstream.status,
                            content_type:
                                upstream.headers.get(
                                    "content-type"
                                ) ?? "",
                            final_host:
                                (() => {
                                    try {
                                        return new URL(
                                            upstream.url
                                        ).host;
                                    } catch {
                                        return "";
                                    }
                                })()
                        }
                    );

                    throw new Error(
                        "GOOGLE_SCRIPT_INVALID_RESPONSE"
                    );
                }

                if (
                    !upstream.ok ||
                    !data ||
                    data.success === false
                ) {
                    console.error(
                        "APPS SCRIPT ERROR",
                        {
                            status:
                                upstream.status,
                            code:
                                String(
                                    data?.code ??
                                        ""
                                ).trim()
                        }
                    );

                    const code =
                        String(
                            data?.code ??
                                ""
                        ).trim();

                    // IMPORTANT: this is Google Apps Script authorization,
                    // not the AdminTools session. Never propagate it as the
                    // generic UNAUTHORIZED auth code, otherwise the web client
                    // redirects the administrator to the login page.
                    if (
                        code ===
                        "UNAUTHORIZED"
                    ) {
                        throw new Error(
                            "APPS_SCRIPT_UNAUTHORIZED"
                        );
                    }

                    throw new Error(
                        code ||
                            "GOOGLE_SCRIPT_ERROR"
                    );
                }

                if (secretIndex > 0) {
                    console.warn(
                        "STATISTICS GOOGLE SECRET FALLBACK USED"
                    );
                }

                return data;
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.name ===
                        "AbortError"
                ) {
                    throw error;
                }

                const normalized =
                    error instanceof Error
                        ? error
                        : new Error(
                            "GOOGLE_SCRIPT_ERROR"
                        );

                lastError = normalized;

                if (
                    (
                        normalized.message ===
                            "APPS_SCRIPT_UNAUTHORIZED" ||
                        normalized.message ===
                            "GOOGLE_SCRIPT_INVALID_RESPONSE"
                    ) &&
                    secretIndex + 1 <
                        scriptSecrets.length
                ) {
                    continue;
                }

                throw normalized;
            }
        }

        throw (
            lastError ??
            new Error(
                "APPS_SCRIPT_UNAUTHORIZED"
            )
        );
    } catch (error) {
        if (
            error instanceof Error &&
            error.name === "AbortError"
        ) {
            throw new Error(
                "GOOGLE_SCRIPT_TIMEOUT"
            );
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
async function myStatistics(
    request: Request
) {
    const { admin } =
        await authenticatedSession(
            request
        );

    const result =
        await appsScript(
            "get_admin",
            {
                nickname:
                    admin.nickname
            }
        );

    return {
        success: true,
        admin: {
            id:
                admin.id,
            login:
                admin.login,
            nickname:
                admin.nickname,
            role:
                admin.role,
            position:
                admin.position
        },
        source: {
            sheet_name:
                result.sheet_name
        },
        statistics:
            {
                row_number:
                    result.row_number,
                values:
                    result.admin,
                headers:
                    result.admin.headers,
                raw_row:
                    result.admin.raw_row
            }
    };
}

async function allStatistics(
    request: Request
) {
    const { admin } =
        await authenticatedSession(
            request
        );

    if (
        admin.role !==
        "management"
    ) {
        throw new Error(
            "FORBIDDEN"
        );
    }

    const result =
        await appsScript(
            "get_all_admins"
        );

    return {
        success: true,
        source: {
            sheet_name:
                result.sheet_name
        },
        statistics:
            Array.isArray(
                result.statistics
            )
                ? result.statistics.map(
                    (item: any) => ({
                        row_number:
                            item.row_number,
                        values:
                            item
                    })
                )
                : []
    };
}

async function updateAdmin(
    request: Request,
    body: any
) {
    const { admin } =
        await authenticatedSession(
            request
        );

    if (
        admin.role !==
        "management"
    ) {
        throw new Error(
            "FORBIDDEN"
        );
    }

    return appsScript(
        "update_admin",
        {
            nickname:
                String(
                    body?.nickname ??
                        ""
                ).trim(),
            changes:
                body?.changes ?? {}
        }
    );
}

async function updateRow(
    request: Request,
    body: any
) {
    const { admin } =
        await authenticatedSession(
            request
        );

    if (
        admin.role !==
        "management"
    ) {
        throw new Error(
            "FORBIDDEN"
        );
    }

    return appsScript(
        "update_row",
        {
            row_number:
                Number(
                    body?.row_number
                ),
            changes:
                body?.changes ?? {}
        }
    );
}

async function appendAdmin(
    request: Request,
    body: any
) {
    const { admin } =
        await authenticatedSession(
            request
        );

    if (
        admin.role !==
        "management"
    ) {
        throw new Error(
            "FORBIDDEN"
        );
    }

    return appsScript(
        "append_admin",
        {
            values:
                body?.values ?? {}
        }
    );
}

async function getRow(
    request: Request,
    body: any
) {
    const { admin } =
        await authenticatedSession(
            request
        );

    if (
        admin.role !==
        "management"
    ) {
        throw new Error(
            "FORBIDDEN"
        );
    }

    return appsScript(
        "get_row",
        {
            row_number:
                Number(
                    body?.row_number
                )
        }
    );
}

async function route(
    request: Request
) {
    const body =
        await request
            .json()
            .catch(
                () => ({})
            );

    const action =
        String(
            body?.action ?? ""
        ).trim();

    switch (action) {
        case "my_statistics":
            return myStatistics(
                request
            );

        case "all_statistics":
            return allStatistics(
                request
            );

        case "admins_google_list":
            return allStatistics(
                request
            );

        case "update_admin":
            return updateAdmin(
                request,
                body
            );

        case "update_row":
            return updateRow(
                request,
                body
            );

        case "append_admin":
            return appendAdmin(
                request,
                body
            );

        case "get_row":
            return getRow(
                request,
                body
            );

        case "health":
            return {
                success: true,
                service:
                    "statistics"
            };

        default:
            throw new Error(
                "UNKNOWN_ACTION"
            );
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
