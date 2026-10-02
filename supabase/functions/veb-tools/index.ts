import { login, getMe, logout } from "./auth.ts";
import { getAdmins, createAdmins } from "./admins.ts";
import { getAuditLogs } from "./audit.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8"
        }
    });
}

function handleError(error: unknown): Response {
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";

    const errors: Record<string, { status: number; message: string }> = {
        SERVER_CONFIGURATION_ERROR: { status: 500, message: "Ошибка конфигурации сервера" },
        LOGIN_DATA_REQUIRED: { status: 400, message: "Введите логин, пароль и устройство" },
        INVALID_CREDENTIALS: { status: 401, message: "Неверный логин или пароль" },
        PASSWORD_NOT_CONFIGURED: { status: 500, message: "Пароль аккаунта не настроен" },
        INACTIVE: { status: 403, message: "Аккаунт не активирован" },
        DEVICE_MISMATCH: { status: 403, message: "Устройство не совпадает" },
        UNAUTHORIZED: { status: 401, message: "Авторизация не пройдена" },
        SESSION_EXPIRED: { status: 401, message: "Сессия истекла" },
        SESSION_IDLE_EXPIRED: { status: 401, message: "Сессия завершена из-за бездействия" },
        SESSION_DATABASE_ERROR: { status: 500, message: "Ошибка проверки сессии" },
        SESSION_CREATE_ERROR: { status: 500, message: "Не удалось создать сессию" },
        ADMIN_DATABASE_ERROR: { status: 500, message: "Ошибка базы администраторов" },
        ADMIN_NOT_FOUND: { status: 404, message: "Администратор не найден" },
        ADMIN_UPDATE_ERROR: { status: 500, message: "Не удалось обновить администратора" },
        FORBIDDEN: { status: 403, message: "Недостаточно прав" },
        ADMINS_ARRAY_REQUIRED: { status: 400, message: "Не передан список администраторов" },
        INVALID_ADMIN_DATA: { status: 400, message: "Некорректные данные администратора" },
        INVALID_ROLE: { status: 400, message: "Недопустимая роль" },
        DATABASE_ERROR: { status: 500, message: "Ошибка базы данных" },
        ADMINS_DATABASE_ERROR: { status: 500, message: "Не удалось получить список администраторов" },
        LOGS_DATABASE_ERROR: { status: 500, message: "Не удалось получить журнал" },
        AUDIT_DATABASE_ERROR: { status: 500, message: "Не удалось записать журнал" },
        UNKNOWN_ACTION: { status: 400, message: "Неизвестное действие" }
    };

    const item = errors[code];

    return json(
        {
            success: false,
            code: item ? code : "INTERNAL_ERROR",
            message: item ? item.message : "Внутренняя ошибка сервера"
        },
        item?.status || 500
    );
}

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return json(
            {
                success: false,
                code: "METHOD_NOT_ALLOWED",
                message: "Разрешён только POST"
            },
            405
        );
    }

    try {
        const body = await request.json().catch(() => ({}));
        const action = String(body?.action || "").trim();

        switch (action) {
            case "login":
                return json(await login(body));
            case "me":
                return json(await getMe(request));
            case "logout":
                return json(await logout(request));
            case "admins_list":
                return json(await getAdmins(request));
            case "create_admins":
                return json(await createAdmins(request, body));
            case "logs":
                return json(await getAuditLogs(request));
            default:
                throw new Error("UNKNOWN_ACTION");
        }
    } catch (error) {
        return handleError(error);
    }
});