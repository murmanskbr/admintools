import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const DB_SECRET_KEY =
    Deno.env.get("DB_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-device-id, cache-control, pragma",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400"
};

const IDLE_TIMEOUT_SECONDS = 180;
const SESSION_LIFETIME_SECONDS = 86400;
const PASSWORD_ITERATIONS = 210000;

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8"
        }
    });
}

function fail(code: string, status: number, message: string): Response {
    return json({ success: false, code, message }, status);
}

function db() {
    if (!SUPABASE_URL || !DB_SECRET_KEY) {
        throw new Error("SERVER_CONFIGURATION_ERROR");
    }

    return createClient(SUPABASE_URL, DB_SECRET_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

async function getGoogleScriptConfig(): Promise<{ webAppUrl: string }> {
    const { data, error } = await db()
        .from("google_script_config")
        .select("web_app_url")
        .eq("id", 1)
        .maybeSingle();

    if (error) {
        console.error("ACCESS GOOGLE CONFIG ERROR", error);
        throw new Error("DATABASE_ERROR");
    }

    return {
        webAppUrl: String(data?.web_app_url ?? "").trim()
    };
}

async function getGoogleScriptSecrets(): Promise<string[]> {
    const secrets: string[] = [];

    const envSecret = String(
        Deno.env.get("GOOGLE_SCRIPT_SECRET") ?? ""
    ).trim();

    if (envSecret) {
        secrets.push(envSecret);
    }

    try {
        const { data, error } = await db()
            .rpc("get_google_script_secret");

        if (!error && data) {
            const databaseSecret = String(data).trim();

            if (
                databaseSecret &&
                secrets.indexOf(databaseSecret) === -1
            ) {
                secrets.push(databaseSecret);
            }
        }

        if (error) {
            console.error(
                "ACCESS GOOGLE SECRET RPC ERROR",
                error
            );
        }
    } catch (error) {
        console.error(
            "ACCESS GOOGLE SECRET ERROR",
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

async function callAppsScript(
    action: string,
    payload: Record<string, unknown> = {}
): Promise<any> {
    const config = await getGoogleScriptConfig();

    if (!config.webAppUrl) {
        throw new Error("APPS_SCRIPT_NOT_CONFIGURED");
    }

    const scriptSecrets = await getGoogleScriptSecrets();

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        50000
    );

    try {
        let lastError: Error | null = null;

        for (
            let secretIndex = 0;
            secretIndex < scriptSecrets.length;
            secretIndex += 1
        ) {
            const googleScriptSecret =
                scriptSecrets[secretIndex];

            try {
                const upstream = await fetch(
                    config.webAppUrl,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json, text/plain, */*"
                        },
                        body: JSON.stringify({
                            secret: googleScriptSecret,
                            action,
                            ...payload
                        }),
                        signal: controller.signal,
                        redirect: "follow",
                        cache: "no-store"
                    }
                );

                const raw = await upstream.text();

                if (!upstream.ok) {
                    console.error(
                        "ACCESS APPS SCRIPT HTTP ERROR",
                        {
                            status:
                                upstream.status,
                            action
                        }
                    );

                    if (upstream.status === 404) {
                        throw new Error("APPS_SCRIPT_HTTP_404");
                    }

                    if (
                        upstream.status === 401 ||
                        upstream.status === 403
                    ) {
                        throw new Error(
                            "APPS_SCRIPT_HTTP_403"
                        );
                    }

                    throw new Error(
                        "APPS_SCRIPT_HTTP_ERROR"
                    );
                }

                let data: any = null;

                try {
                    data = raw ? JSON.parse(raw) : null;
                } catch (error) {
                    console.error(
                        "ACCESS APPS SCRIPT INVALID RESPONSE",
                        {
                            status:
                                upstream.status,
                            content_type:
                                upstream.headers.get(
                                    "content-type"
                                ) ?? "",
                            action,
                            error
                        }
                    );

                    throw new Error(
                        "APPS_SCRIPT_INVALID_RESPONSE"
                    );
                }

                if (!data || data.success === false) {
                    const code = String(
                        data?.code ?? ""
                    ).trim();

                    console.error(
                        "ACCESS APPS SCRIPT ERROR",
                        {
                            status:
                                upstream.status,
                            code,
                            action
                        }
                    );

                    if (
                        code ===
                        "UNAUTHORIZED"
                    ) {
                        throw new Error(
                            "APPS_SCRIPT_UNAUTHORIZED"
                        );
                    }

                    if (
                        code ===
                        "SCRIPT_SECRET_NOT_CONFIGURED"
                    ) {
                        throw new Error(
                            "APPS_SCRIPT_SECRET_NOT_CONFIGURED"
                        );
                    }

                    if (
                        code ===
                        "SPREADSHEET_NOT_INITIALIZED"
                    ) {
                        throw new Error(
                            "APPS_SCRIPT_SPREADSHEET_NOT_INITIALIZED"
                        );
                    }

                    throw new Error(
                        code ||
                        "APPS_SCRIPT_ERROR"
                    );
                }

                if (secretIndex > 0) {
                    console.warn(
                        "ACCESS GOOGLE SECRET FALLBACK USED"
                    );
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
                        : new Error(
                            "APPS_SCRIPT_ERROR"
                        );

                lastError = normalized;

                if (
                    (
                        normalized.message ===
                            "APPS_SCRIPT_UNAUTHORIZED" ||
                        normalized.message ===
                            "APPS_SCRIPT_INVALID_RESPONSE"
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
                "APPS_SCRIPT_TIMEOUT"
            );
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("");
}

function fromHex(value: string): Uint8Array {
    if (!value || value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
        throw new Error("INVALID_HEX");
    }

    const bytes = new Uint8Array(value.length / 2);

    for (let i = 0; i < value.length; i += 2) {
        bytes[i / 2] = parseInt(value.slice(i, i + 2), 16);
    }

    return bytes;
}

async function sha256(value: string): Promise<string> {
    const buffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(value)
    );

    return toHex(new Uint8Array(buffer));
}

async function createPasswordHash(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derived = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations: PASSWORD_ITERATIONS,
            hash: "SHA-256"
        },
        key,
        256
    );

    return toHex(salt) + ":" + toHex(new Uint8Array(derived));
}

async function verifyPassword(
    password: string,
    storedHash: string
): Promise<{ valid: boolean; legacy: boolean }> {
    if (!storedHash) {
        return { valid: false, legacy: false };
    }

    if (!storedHash.includes(":")) {
        return {
            valid: (await sha256(password)) === storedHash.toLowerCase(),
            legacy: true
        };
    }

    const parts = storedHash.split(":");

    if (parts.length !== 2) {
        return { valid: false, legacy: false };
    }

    const salt =
        new Uint8Array(
            fromHex(parts[0])
        );
    const expected = fromHex(parts[1]);

    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derived = new Uint8Array(
        await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt:
                    salt as unknown as BufferSource,
                iterations:
                    PASSWORD_ITERATIONS,
                hash: "SHA-256"
            },
            key,
            256
        )
    );

    if (expected.length !== derived.length) {
        return { valid: false, legacy: false };
    }

    let difference = 0;

    for (let i = 0; i < expected.length; i++) {
        difference |= expected[i] ^ derived[i];
    }

    return {
        valid: difference === 0,
        legacy: false
    };
}

function generateToken(): string {
    return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

function getBearer(request: Request): string | null {
    const header = request.headers.get("authorization");

    if (!header) {
        return null;
    }

    const parts = header.trim().split(/\s+/);

    if (
        parts.length !== 2 ||
        parts[0].toLowerCase() !== "bearer"
    ) {
        return null;
    }

    return parts[1];
}

async function writeAudit(
    adminId: number | null,
    nickname: string,
    action: string,
    details: string | null,
    page: string | null
) {
    const { error } = await db()
        .from("audit_logs")
        .insert({
            admin_id: adminId,
            nickname,
            action,
            details,
            page
        });

    if (error) {
        console.error("AUDIT ERROR", error);
    }
}

async function revokeSession(sessionId: number) {
    const { error } = await db()
        .from("admin_sessions")
        .update({
            revoked_at: new Date().toISOString()
        })
        .eq("id", sessionId);

    if (error) {
        console.error("REVOKE SESSION ERROR", error);
    }
}

async function authenticate(request: Request) {
    const rawToken = getBearer(request);

    if (!rawToken) {
        throw new Error("UNAUTHORIZED");
    }

    const tokenHash = await sha256(rawToken);

    const { data: session, error: sessionError } = await db()
        .from("admin_sessions")
        .select(
            "id,admin_id,token_hash,device_id,expires_at,last_activity_at,created_at,revoked_at"
        )
        .eq("token_hash", tokenHash)
        .is("revoked_at", null)
        .maybeSingle();

    if (sessionError) {
        console.error("SESSION QUERY ERROR", sessionError);
        throw new Error("SESSION_DATABASE_ERROR");
    }

    if (!session) {
        throw new Error("UNAUTHORIZED");
    }

    const now = Date.now();
    const expiresAt = new Date(session.expires_at).getTime();

    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
        await revokeSession(session.id);
        throw new Error("SESSION_EXPIRED");
    }

    if (IDLE_TIMEOUT_SECONDS > 0 && session.last_activity_at) {
        const lastActivity = new Date(session.last_activity_at).getTime();

        if (
            Number.isFinite(lastActivity) &&
            now - lastActivity > IDLE_TIMEOUT_SECONDS * 1000
        ) {
            await revokeSession(session.id);
            throw new Error("SESSION_IDLE_EXPIRED");
        }
    }

    const requestDeviceId =
        request.headers.get("x-device-id")?.trim() || null;

    if (session.device_id && requestDeviceId) {
        const requestDeviceHash = await sha256(requestDeviceId);

        if (session.device_id !== requestDeviceHash) {
            throw new Error("DEVICE_MISMATCH");
        }
    }

    const { data: rawAdmin, error: adminError } = await db()
        .from("admins")
        .select(
            "id,login,nickname,password_hash,device_id,auth_token_hash,is_active,role,position,theme,created_at"
        )
        .eq("id", session.admin_id)
        .maybeSingle();

    if (adminError) {
        console.error("ADMIN QUERY ERROR", adminError);
        throw new Error("ADMIN_DATABASE_ERROR");
    }

    const admin =
        rawAdmin as (typeof rawAdmin & {
            theme?: string | null;
        });

    if (!admin) {
        throw new Error("ADMIN_NOT_FOUND");
    }

    if (!admin.is_active) {
        throw new Error("ACCOUNT_INACTIVE");
    }

    if (admin.device_id && requestDeviceId) {
        const requestDeviceHash = await sha256(requestDeviceId);

        if (admin.device_id !== requestDeviceHash) {
            throw new Error("DEVICE_MISMATCH");
        }
    }

    const { error: activityError } = await db()
        .from("admin_sessions")
        .update({
            last_activity_at: new Date().toISOString()
        })
        .eq("id", session.id);

    if (activityError) {
        console.error("SESSION ACTIVITY UPDATE ERROR", activityError);
    }

    return {
        admin,
        session,
        token: rawToken
    };
}

function getClientIp(request: Request): string | null {
    const candidates = [
        request.headers.get("cf-connecting-ip"),
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        request.headers.get("x-real-ip")
    ];

    for (const value of candidates) {
        const ip = String(value ?? "").trim();

        if (!ip) continue;

        if (
            ip.includes(":") ||
            /^\d{1,3}(\.\d{1,3}){3}$/.test(ip)
        ) {
            return ip;
        }
    }

    return null;
}

function normalizeAccessRole(value: unknown): string {
    const role = String(value ?? "").trim();

    if (
        role !== "admin" &&
        role !== "management"
    ) {
        throw new Error("INVALID_ROLE");
    }

    return role;
}

function generateAccessPassword(
    length = 10
): string {
    const alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    const bytes =
        crypto.getRandomValues(
            new Uint8Array(length)
        );

    let result = "";

    for (
        let i = 0;
        i < bytes.length;
        i += 1
    ) {
        result +=
            alphabet[
                bytes[i] % alphabet.length
            ];
    }

    return result;
}

function accessNickname(value: unknown): string {
    return String(value ?? "").trim();
}

function accessNicknameKey(value: unknown): string {
    return accessNickname(value)
        .toLocaleLowerCase("ru-RU");
}

function normalizeAccessRosterText(
    value: unknown
): string {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/ё/g, "е")
        .replace(/[._-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isAccessCategoryLabel(
    value: unknown
): boolean {
    const text = normalizeAccessRosterText(value);

    if (!text) return false;

    const exact = new Set([
        "администратор",
        "администраторы",
        "старший администратор",
        "старшие администраторы",
        "модератор",
        "модераторы",
        "старший модератор",
        "старшие модераторы",
        "младший модератор",
        "младшие модераторы",
        "следящий",
        "следящие",
        "старший следящий",
        "старшие следящие",
        "старшие следящие за ап",
        "следящие за ап",
        "руководство",
        "куратор",
        "кураторы",
        "управление"
    ]);

    if (exact.has(text)) return true;

    const roleWord =
        text.includes("администратор") ||
        text.includes("модератор") ||
        text.includes("следящ") ||
        text.includes("куратор") ||
        text.includes("руковод") ||
        text.includes("управлен");

    return roleWord && /\s/.test(text);
}

function isAccessCategoryRow(
    item: any,
    nicknameIndex: number,
    raw: unknown[]
): boolean {
    const nickname =
        nicknameIndex >= 0
            ? accessNickname(raw[nicknameIndex])
            : accessNickname(item?.nickname);

    if (!nickname) return true;

    if (isAccessCategoryLabel(nickname)) {
        return true;
    }

    let nonEmpty = 0;

    for (const value of raw) {
        if (String(value ?? "").trim() !== "") {
            nonEmpty += 1;
            if (nonEmpty > 1) return false;
        }
    }

    return false;
}

function extractGoogleAccessNicknames(
    result: any
): string[] {
    const statistics =
        Array.isArray(result?.statistics)
            ? result.statistics
            : [];

    const unique =
        new Map<string, string>();

    for (const item of statistics) {
        const headers =
            Array.isArray(
                item?.values?.headers
            )
                ? item.values.headers
                : [];

        const raw =
            Array.isArray(
                item?.values?.raw_row
            )
                ? item.values.raw_row
                : [];

        let nicknameIndex = -1;

        for (
            let i = 0;
            i < headers.length;
            i += 1
        ) {
            const header =
                String(
                    headers[i] ?? ""
                )
                    .trim()
                    .toLowerCase()
                    .replace(/ё/g, "е")
                    .replace(/\s+/g, " ");

            if (
                header === "никнейм" ||
                header === "ник" ||
                header === "nickname" ||
                header === "nick" ||
                header === "логин" ||
                header === "login"
            ) {
                nicknameIndex = i;
                break;
            }
        }

        const nickname =
            nicknameIndex >= 0
                ? accessNickname(
                      raw[nicknameIndex]
                  )
                : accessNickname(
                      item?.nickname
                  );

        if (!nickname) continue;

        // Заголовки разделов Google Таблицы никогда не попадают
        // в список кандидатов на выдачу доступа.
        if (
            isAccessCategoryRow(
                item,
                nicknameIndex,
                raw
            )
        ) {
            continue;
        }

        unique.set(
            accessNicknameKey(nickname),
            nickname
        );
    }

    return Array.from(
        unique.values()
    );
}

async function accessCandidates(
    request: Request
) {
    const { admin } =
        await authenticate(request);

    if (
        admin.role !== "management"
    ) {
        throw new Error("FORBIDDEN");
    }

    const googleResult =
        await callAppsScript(
            "get_all_admins"
        );

    const googleNicknames =
        extractGoogleAccessNicknames(
            googleResult
        );

    const { data: accounts, error } =
        await db()
            .from("admins")
            .select(
                "id,nickname,is_active,blocked_at"
            );

    if (error) {
        console.error(
            "ACCESS CANDIDATES DB ERROR",
            error
        );
        throw new Error(
            "ADMINS_DATABASE_ERROR"
        );
    }

    const existing =
        new Map(
            (accounts ?? []).map(
                (item: any) => [
                    accessNicknameKey(
                        item.nickname
                    ),
                    item
                ]
            )
        );

    const candidates =
        googleNicknames.filter(
            (nickname) => {
                const item =
                    existing.get(
                        accessNicknameKey(
                            nickname
                        )
                    );

                if (
                    item?.is_active === true
                ) {
                    return false;
                }

                if (
                    item?.blocked_at
                ) {
                    return false;
                }

                return true;
            }
        );

    return {
        success: true,
        candidates,
        count:
            candidates.length,
        source: {
            type:
                "google_apps_script"
        }
    };
}

async function accessList(
    request: Request
) {
    const { admin } =
        await authenticate(request);

    if (
        admin.role !== "management"
    ) {
        throw new Error("FORBIDDEN");
    }

    const { data, error } =
        await db()
            .from("admins")
            .select(
                "id,login,nickname,role,position,is_active,device_id,last_login_at,last_login_ip,blocked_at,blocked_by,blocked_reason,created_at"
            )
            .or(
                "is_active.eq.true,blocked_at.not.is.null,login.not.is.null"
            )
            .order(
                "is_active",
                {
                    ascending: false
                }
            )
            .order(
                "nickname",
                {
                    ascending: true
                }
            );

    if (error) {
        console.error(
            "ACCESS LIST ERROR",
            error
        );
        throw new Error(
            "ADMINS_DATABASE_ERROR"
        );
    }

    const accounts =
        data ?? [];

    const sessionsByAdmin =
        new Map<number, number>();

    if (accounts.length) {
        const ids =
            accounts.map(
                (item: any) =>
                    item.id
            );

        const {
            data: sessions,
            error: sessionsError
        } = await db()
            .from("admin_sessions")
            .select("admin_id")
            .in(
                "admin_id",
                ids
            )
            .is(
                "revoked_at",
                null
            )
            .gt(
                "expires_at",
                new Date().toISOString()
            );

        if (!sessionsError) {
            for (
                const session
                of sessions ?? []
            ) {
                const id =
                    Number(
                        session.admin_id
                    );

                sessionsByAdmin.set(
                    id,
                    (
                        sessionsByAdmin.get(
                            id
                        ) ?? 0
                    ) + 1
                );
            }
        }
    }

    return {
        success: true,
        administrators:
            accounts.map(
                (item: any) => ({
                    id: item.id,
                    login: item.login,
                    nickname:
                        item.nickname,
                    role:
                        item.role,
                    position:
                        item.position,
                    is_active:
                        item.is_active,
                    device_bound:
                        Boolean(
                            item.device_id
                        ),
                    last_login_at:
                        item.last_login_at,
                    last_login_ip:
                        item.last_login_ip,
                    blocked_at:
                        item.blocked_at,
                    blocked_reason:
                        item.blocked_reason,
                    created_at:
                        item.created_at,
                    active_sessions:
                        sessionsByAdmin.get(
                            Number(
                                item.id
                            )
                        ) ?? 0
                })
            )
    };
}

async function accessGrant(
    request: Request,
    body: any
) {
    const { admin } =
        await authenticate(request);

    if (
        admin.role !== "management"
    ) {
        throw new Error("FORBIDDEN");
    }

    let nicknames: string[] = [];

    if (
        Array.isArray(
            body?.nicknames
        )
    ) {
        nicknames =
            body.nicknames
                .map(
                    (value: unknown) =>
                        accessNickname(
                            value
                        )
                )
                .filter(Boolean);
    } else if (
        body?.nickname
    ) {
        nicknames = [
            accessNickname(
                body.nickname
            )
        ];
    }

    nicknames =
        Array.from(
            new Map(
                nicknames.map(
                    (nickname) => [
                        accessNicknameKey(
                            nickname
                        ),
                        nickname
                    ]
                )
            ).values()
        );

    if (!nicknames.length) {
        throw new Error(
            "ADMINS_ARRAY_REQUIRED"
        );
    }

    if (
        nicknames.length > 100
    ) {
        throw new Error(
            "TOO_MANY_ADMINS"
        );
    }

    const role =
        normalizeAccessRole(
            body?.role
        );

    const position =
        accessNickname(
            body?.position
        );

    const password =
        accessNickname(
            body?.password
        ) ||
        generateAccessPassword();

    if (
        password.length < 6
    ) {
        throw new Error(
            "PASSWORD_TOO_SHORT"
        );
    }

    const credentials: Array<
        Record<string, unknown>
    > = [];

    for (
        const nickname
        of nicknames
    ) {
        const {
            data: existing,
            error: findError
        } = await db()
            .from("admins")
            .select(
                "id,nickname,is_active,blocked_at"
            )
            .eq(
                "nickname",
                nickname
            )
            .maybeSingle();

        if (findError) {
            console.error(
                "ACCESS GRANT FIND ERROR",
                findError
            );
            throw new Error(
                "ADMINS_DATABASE_ERROR"
            );
        }

        if (
            existing?.blocked_at
        ) {
            throw new Error(
                "ACCOUNT_BLOCKED"
            );
        }

        const passwordHash =
            await createPasswordHash(
                password
            );

        const patch = {
            login: nickname,
            nickname,
            password_hash:
                passwordHash,
            is_active: true,
            role,
            position:
                position || null,
            auth_token_hash: null,
            blocked_at: null,
            blocked_by: null,
            blocked_reason: null
        };

        let result;

        if (existing) {
            result = await db()
                .from("admins")
                .update(patch)
                .eq(
                    "id",
                    existing.id
                )
                .select(
                    "id,login,nickname,role,position,is_active"
                )
                .single();
        } else {
            result = await db()
                .from("admins")
                .insert(patch)
                .select(
                    "id,login,nickname,role,position,is_active"
                )
                .single();
        }

        if (result.error) {
            console.error(
                "ACCESS GRANT WRITE ERROR",
                result.error
            );
            throw new Error(
                "ADMIN_UPDATE_ERROR"
            );
        }

        await writeAudit(
            admin.id,
            admin.nickname,
            "access_grant",
            "Выдан доступ: " +
                nickname +
                ", роль: " +
                role,
            "access"
        );

        credentials.push({
            nickname,
            role,
            password
        });
    }

    return {
        success: true,
        granted:
            credentials
    };
}

async function accessManage(
    request: Request,
    body: any
) {
    const { admin } =
        await authenticate(request);

    if (
        admin.role !== "management"
    ) {
        throw new Error("FORBIDDEN");
    }

    const adminId =
        Number(
            body?.admin_id
        );

    if (
        !Number.isFinite(
            adminId
        ) ||
        adminId < 1
    ) {
        throw new Error(
            "ADMIN_NOT_FOUND"
        );
    }

    const operation =
        String(
            body?.operation ?? ""
        ).trim();

    const {
        data: target,
        error: targetError
    } = await db()
        .from("admins")
        .select(
            "id,login,nickname,role,position,is_active,device_id,last_login_at,last_login_ip,blocked_at,blocked_by,blocked_reason,created_at"
        )
        .eq(
            "id",
            adminId
        )
        .maybeSingle();

    if (targetError) {
        console.error(
            "ACCESS TARGET ERROR",
            targetError
        );
        throw new Error(
            "ADMINS_DATABASE_ERROR"
        );
    }

    if (!target) {
        throw new Error(
            "ADMIN_NOT_FOUND"
        );
    }

    if (
        operation === "update"
    ) {
        const role =
            normalizeAccessRole(
                body?.role
            );

        const position =
            accessNickname(
                body?.position
            );

        const newPassword =
            accessNickname(
                body?.password
            );

        const patch: Record<
            string,
            unknown
        > = {
            role,
            position:
                position || null
        };

        if (newPassword) {
            if (
                newPassword.length < 6
            ) {
                throw new Error(
                    "PASSWORD_TOO_SHORT"
                );
            }

            patch.password_hash =
                await createPasswordHash(
                    newPassword
                );

            patch.auth_token_hash =
                null;
        }

        const { error } =
            await db()
                .from("admins")
                .update(patch)
                .eq(
                    "id",
                    adminId
                );

        if (error) {
            console.error(
                "ACCESS EDIT ERROR",
                error
            );
            throw new Error(
                "ADMIN_UPDATE_ERROR"
            );
        }

        if (newPassword) {
            await db()
                .from("admin_sessions")
                .update({
                    revoked_at:
                        new Date().toISOString()
                })
                .eq(
                    "admin_id",
                    adminId
                )
                .is(
                    "revoked_at",
                    null
                );
        }

        await writeAudit(
            admin.id,
            admin.nickname,
            "access_update",
            "Изменён доступ: " +
                target.nickname,
            "access"
        );

        return {
            success: true,
            operation,
            message:
                "Данные доступа изменены."
        };
    }

    if (
        operation === "unbind"
    ) {
        const { error } =
            await db()
                .from("admins")
                .update({
                    device_id:
                        null,
                    auth_token_hash:
                        null
                })
                .eq(
                    "id",
                    adminId
                );

        if (error) {
            console.error(
                "ACCESS UNBIND ERROR",
                error
            );
            throw new Error(
                "ADMIN_UPDATE_ERROR"
            );
        }

        await db()
            .from("admin_sessions")
            .update({
                revoked_at:
                    new Date().toISOString()
            })
            .eq(
                "admin_id",
                adminId
            )
            .is(
                "revoked_at",
                null
            );

        await writeAudit(
            admin.id,
            admin.nickname,
            "access_unbind",
            "Сброшена привязка устройства: " +
                target.nickname,
            "access"
        );

        return {
            success: true,
            operation,
            message:
                "Привязка устройства удалена."
        };
    }

    if (
        operation === "block"
    ) {
        if (
            Number(admin.id) ===
            Number(adminId)
        ) {
            throw new Error(
                "SELF_ACCESS_FORBIDDEN"
            );
        }

        const { error } =
            await db()
                .from("admins")
                .update({
                    is_active:
                        false,
                    blocked_at:
                        new Date().toISOString(),
                    blocked_by:
                        admin.id,
                    blocked_reason:
                        accessNickname(
                            body?.reason
                        ) ||
                        "Заблокировано руководством"
                })
                .eq(
                    "id",
                    adminId
                );

        if (error) {
            console.error(
                "ACCESS BLOCK ERROR",
                error
            );
            throw new Error(
                "ADMIN_UPDATE_ERROR"
            );
        }

        await db()
            .from("admin_sessions")
            .update({
                revoked_at:
                    new Date().toISOString()
            })
            .eq(
                "admin_id",
                adminId
            )
            .is(
                "revoked_at",
                null
            );

        await writeAudit(
            admin.id,
            admin.nickname,
            "access_block",
            "Заблокирован доступ: " +
                target.nickname,
            "access"
        );

        return {
            success: true,
            operation,
            message:
                "Администратор заблокирован."
        };
    }

    if (
        operation === "unblock"
    ) {
        const { error } =
            await db()
                .from("admins")
                .update({
                    is_active:
                        true,
                    blocked_at:
                        null,
                    blocked_by:
                        null,
                    blocked_reason:
                        null
                })
                .eq(
                    "id",
                    adminId
                );

        if (error) {
            console.error(
                "ACCESS UNBLOCK ERROR",
                error
            );
            throw new Error(
                "ADMIN_UPDATE_ERROR"
            );
        }

        await writeAudit(
            admin.id,
            admin.nickname,
            "access_unblock",
            "Разблокирован доступ: " +
                target.nickname,
            "access"
        );

        return {
            success: true,
            operation,
            message:
                "Администратор разблокирован."
        };
    }

    if (
        operation === "remove"
    ) {
        if (
            Number(admin.id) ===
            Number(adminId)
        ) {
            throw new Error(
                "SELF_ACCESS_FORBIDDEN"
            );
        }

        const { error } =
            await db()
                .from("admins")
                .update({
                    login: null,
                    password_hash:
                        null,
                    auth_token_hash:
                        null,
                    device_id:
                        null,
                    is_active:
                        false,
                    blocked_at:
                        null,
                    blocked_by:
                        null,
                    blocked_reason:
                        null
                })
                .eq(
                    "id",
                    adminId
                );

        if (error) {
            console.error(
                "ACCESS REMOVE ERROR",
                error
            );
            throw new Error(
                "ADMIN_UPDATE_ERROR"
            );
        }

        await db()
            .from("admin_sessions")
            .update({
                revoked_at:
                    new Date().toISOString()
            })
            .eq(
                "admin_id",
                adminId
            )
            .is(
                "revoked_at",
                null
            );

        await writeAudit(
            admin.id,
            admin.nickname,
            "access_remove",
            "Удалён доступ: " +
                target.nickname,
            "access"
        );

        return {
            success: true,
            operation,
            message:
                "Доступ удалён."
        };
    }

    throw new Error(
        "UNKNOWN_ACTION"
    );
}

async function login(request: Request, body: any) {
    const loginValue = String(body?.login ?? "").trim();
    const password = String(body?.password ?? "");
    const deviceId = String(body?.device_id ?? "").trim();

    if (!loginValue || !password || !deviceId) {
        throw new Error("LOGIN_DATA_REQUIRED");
    }

    const { data: admin, error } = await db()
        .from("admins")
        .select(
            "id,login,nickname,password_hash,device_id,auth_token_hash,is_active,role,position,created_at"
        )
        .eq("login", loginValue)
        .maybeSingle();

    if (error) {
        console.error("LOGIN QUERY ERROR", error);
        throw new Error("ADMIN_DATABASE_ERROR");
    }

    if (!admin) {
        throw new Error("INVALID_CREDENTIALS");
    }

    if (!admin.password_hash) {
        throw new Error("PASSWORD_NOT_CONFIGURED");
    }

    const passwordResult = await verifyPassword(
        password,
        admin.password_hash
    );

    if (!passwordResult.valid) {
        throw new Error("INVALID_CREDENTIALS");
    }

    if (!admin.is_active) {
        throw new Error("ACCOUNT_INACTIVE");
    }

    const deviceHash = await sha256(deviceId);

    if (admin.device_id && admin.device_id !== deviceHash) {
        throw new Error("DEVICE_MISMATCH");
    }

    if (!admin.device_id) {
        const { error: deviceError } = await db()
            .from("admins")
            .update({
                device_id: deviceHash
            })
            .eq("id", admin.id);

        if (deviceError) {
            console.error("DEVICE UPDATE ERROR", deviceError);
            throw new Error("ADMIN_UPDATE_ERROR");
        }
    }

    const loginAt = new Date().toISOString();
    const loginIp = getClientIp(request);

    const { error: loginMetaError } = await db()
        .from("admins")
        .update({
            last_login_at: loginAt,
            last_login_ip: loginIp
        })
        .eq("id", admin.id);

    if (loginMetaError) {
        console.error("LOGIN META UPDATE ERROR", loginMetaError);
    }

    if (passwordResult.legacy) {
        const upgradedHash = await createPasswordHash(password);

        const { error: hashUpgradeError } = await db()
            .from("admins")
            .update({
                password_hash: upgradedHash
            })
            .eq("id", admin.id);

        if (hashUpgradeError) {
            console.error("PASSWORD UPGRADE ERROR", hashUpgradeError);
        }
    }

    const now = new Date();
    const expiresAt = new Date(
        now.getTime() + SESSION_LIFETIME_SECONDS * 1000
    );

    const { error: revokeError } = await db()
        .from("admin_sessions")
        .update({
            revoked_at: now.toISOString()
        })
        .eq("admin_id", admin.id)
        .is("revoked_at", null);

    if (revokeError) {
        console.error("REVOKE OLD SESSIONS ERROR", revokeError);
    }

    const rawToken = generateToken();
    const tokenHash = await sha256(rawToken);

    const { data: session, error: sessionError } = await db()
        .from("admin_sessions")
        .insert({
            admin_id: admin.id,
            token_hash: tokenHash,
            device_id: deviceHash,
            expires_at: expiresAt.toISOString(),
            last_activity_at: now.toISOString()
        })
        .select("id,expires_at,last_activity_at,created_at")
        .single();

    if (sessionError) {
        console.error("SESSION CREATE ERROR", sessionError);
        throw new Error("SESSION_CREATE_ERROR");
    }

    const { error: tokenUpdateError } = await db()
        .from("admins")
        .update({
            auth_token_hash: tokenHash,
            device_id: deviceHash
        })
        .eq("id", admin.id);

    if (tokenUpdateError) {
        console.error("TOKEN UPDATE ERROR", tokenUpdateError);
    }

    await writeAudit(
        admin.id,
        admin.nickname,
        "login",
        "Авторизация выполнена",
        "auth"
    );

    return {
        success: true,
        token: rawToken,
        expires_at: session.expires_at,
        session: {
            id: session.id,
            expires_at: session.expires_at,
            last_activity_at: session.last_activity_at
        },
        admin: {
            id: admin.id,
            login: admin.login,
            nickname: admin.nickname,
            role: admin.role,
            position: admin.position,
            is_active: admin.is_active,
            theme: admin.theme || "dark"
        }
    };
}

async function getMe(request: Request) {
    const { admin, session } = await authenticate(request);

    return {
        success: true,
        admin: {
            id: admin.id,
            login: admin.login,
            nickname: admin.nickname,
            role: admin.role,
            position: admin.position,
            is_active: admin.is_active,
            theme: admin.theme || "dark"
        },
        session: {
            id: session.id,
            expires_at: session.expires_at,
            last_activity_at: session.last_activity_at
        }
    };
}

async function logout(request: Request) {
    const { admin, session } = await authenticate(request);

    await revokeSession(session.id);

    const { error } = await db()
        .from("admins")
        .update({
            auth_token_hash: null
        })
        .eq("id", admin.id);

    if (error) {
        console.error("CLEAR TOKEN ERROR", error);
    }

    await writeAudit(
        admin.id,
        admin.nickname,
        "logout",
        "Выход из аккаунта",
        "auth"
    );

    return { success: true };
}

async function adminsList(request: Request) {
    const { admin } = await authenticate(request);

    const { data, error } = await db()
        .from("admins")
        .select(
            "id,nickname,login,role,position,is_active,created_at"
        )
        .order("nickname", { ascending: true });

    if (error) {
        console.error("ADMINS LIST ERROR", error);
        throw new Error("ADMINS_DATABASE_ERROR");
    }

    await writeAudit(
        admin.id,
        admin.nickname,
        "admins_list",
        "Просмотр списка администрации",
        "admins"
    );

    return {
        success: true,
        admins: data ?? []
    };
}

async function createAdmins(request: Request, body: any) {
    const { admin: currentAdmin } = await authenticate(request);

    if (currentAdmin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    let items = body?.admins;

    if (!Array.isArray(items)) {
        items = [body];
    }

    if (!items.length) {
        throw new Error("ADMINS_ARRAY_REQUIRED");
    }

    const created = [];

    for (const item of items) {
        const login = String(item?.login ?? "").trim();
        const nickname = String(item?.nickname ?? "").trim();
        const password = String(item?.password ?? "");
        const role = String(item?.role ?? "admin").trim();
        const position =
            item?.position == null
                ? null
                : String(item.position).trim();

        if (!login || !nickname || !password) {
            throw new Error("INVALID_ADMIN_DATA");
        }

        if (role !== "admin" && role !== "management") {
            throw new Error("INVALID_ROLE");
        }

        const passwordHash = await createPasswordHash(password);

        const { data, error } = await db()
            .from("admins")
            .insert({
                login,
                nickname,
                password_hash: passwordHash,
                role,
                position,
                device_id: null,
                auth_token_hash: null,
                is_active: true
            })
            .select(
                "id,nickname,login,role,position,is_active,created_at"
            )
            .single();

        if (error) {
            console.error("CREATE ADMIN ERROR", error);
            throw new Error("DATABASE_ERROR");
        }

        created.push(data);
    }

    await writeAudit(
        currentAdmin.id,
        currentAdmin.nickname,
        "create_admins",
        "Создано аккаунтов: " + created.length,
        "admins"
    );

    return {
        success: true,
        admins: created
    };
}


async function getSettings(request: Request) {
    const { admin } = await authenticate(request);

    let webAppUrl: string | null = null;

    if (admin.role === "management") {
        const { data, error } = await db()
            .from("google_script_config")
            .select("web_app_url")
            .eq("id", 1)
            .maybeSingle();

        if (error) {
            console.error("SETTINGS GOOGLE URL QUERY ERROR", error);
            throw new Error("DATABASE_ERROR");
        }

        webAppUrl = data?.web_app_url ?? null;
    }

    return {
        success: true,
        settings: {
            theme: admin.theme || "dark",
            web_app_url: webAppUrl
        }
    };
}

function validateTheme(value: string) {
    if (value !== "dark" && value !== "light") {
        throw new Error("INVALID_THEME");
    }
    return value;
}

function validateWebAppUrl(value: string) {
    const url = String(value ?? "").trim();

    if (!url) return "";

    let parsed: URL;

    try {
        parsed = new URL(url);
    } catch (_) {
        throw new Error("INVALID_WEB_APP_URL");
    }

    const path = parsed.pathname;

    if (
        parsed.protocol !== "https:" ||
        parsed.hostname !== "script.google.com" ||
        !path.startsWith("/macros/s/") ||
        !(path.endsWith("/exec") || path.endsWith("/exec/"))
    ) {
        throw new Error("INVALID_WEB_APP_URL");
    }

    return url.replace(/\/$/, "");
}

async function updateSettings(request: Request, body: any) {
    const { admin, session } = await authenticate(request);

    const hasTheme = body?.theme !== undefined;
    const hasPassword = body?.new_password !== undefined;
    const hasWebAppUrl = body?.web_app_url !== undefined;

    if (!hasTheme && !hasPassword && !hasWebAppUrl) {
        throw new Error("SETTINGS_DATA_REQUIRED");
    }

    if (hasWebAppUrl && admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    let validatedWebAppUrl: string | null = null;
    if (hasWebAppUrl) {
        const value = validateWebAppUrl(body.web_app_url);
        validatedWebAppUrl = value || null;
    }

    const dbClient = db();

    if (hasTheme) {
        const theme = validateTheme(String(body.theme ?? "").trim());

        const { error } = await dbClient
            .from("admins")
            .update({ theme })
            .eq("id", admin.id);

        if (error) {
            console.error("THEME UPDATE ERROR", error);
            throw new Error("ADMIN_UPDATE_ERROR");
        }
    }

    if (hasPassword) {
        const currentPassword = String(body?.current_password ?? "");
        const newPassword = String(body?.new_password ?? "");

        if (!currentPassword || !newPassword) {
            throw new Error("PASSWORD_DATA_REQUIRED");
        }

        if (newPassword.length < 6) {
            throw new Error("PASSWORD_TOO_SHORT");
        }

        const currentResult = await verifyPassword(
            currentPassword,
            admin.password_hash
        );

        if (!currentResult.valid) {
            throw new Error("INVALID_CREDENTIALS");
        }

        const passwordHash = await createPasswordHash(newPassword);

        const { error: passwordError } = await dbClient
            .from("admins")
            .update({
                password_hash: passwordHash
            })
            .eq("id", admin.id);

        if (passwordError) {
            console.error("PASSWORD UPDATE ERROR", passwordError);
            throw new Error("ADMIN_UPDATE_ERROR");
        }

        const { error: sessionsError } = await dbClient
            .from("admin_sessions")
            .update({
                revoked_at: new Date().toISOString()
            })
            .eq("admin_id", admin.id)
            .neq("id", session.id)
            .is("revoked_at", null);

        if (sessionsError) {
            console.error("OTHER SESSIONS REVOKE ERROR", sessionsError);
        }
    }

    let savedWebAppUrl: string | null = null;

    if (hasWebAppUrl) {
        savedWebAppUrl = validatedWebAppUrl;

        const { data: existingConfig, error: existingConfigError } = await dbClient
            .from("google_script_config")
            .select("id")
            .eq("id", 1)
            .maybeSingle();

        if (existingConfigError) {
            console.error("GOOGLE SCRIPT CONFIG QUERY ERROR", existingConfigError);
            throw new Error("DATABASE_ERROR");
        }

        let writeResult;

        if (existingConfig) {
            writeResult = await dbClient
                .from("google_script_config")
                .update({
                    web_app_url: savedWebAppUrl || null,
                    updated_at: new Date().toISOString()
                })
                .eq("id", 1);
        } else {
            writeResult = await dbClient
                .from("google_script_config")
                .insert({
                    id: 1,
                    web_app_url: savedWebAppUrl || null
                });
        }

        if (writeResult.error) {
            console.error("GOOGLE SCRIPT CONFIG WRITE ERROR", writeResult.error);
            throw new Error("DATABASE_ERROR");
        }

        const { data: verifiedConfig, error: verifyConfigError } = await dbClient
            .from("google_script_config")
            .select("web_app_url")
            .eq("id", 1)
            .maybeSingle();

        if (verifyConfigError) {
            console.error("GOOGLE SCRIPT CONFIG VERIFY ERROR", verifyConfigError);
            throw new Error("DATABASE_ERROR");
        }

        savedWebAppUrl = verifiedConfig?.web_app_url ?? null;
    }

    const { data: updatedAdmin, error: updatedAdminError } = await dbClient
        .from("admins")
        .select("id,login,nickname,role,position,theme,is_active")
        .eq("id", admin.id)
        .single();

    if (updatedAdminError) {
        console.error("UPDATED ADMIN QUERY ERROR", updatedAdminError);
        throw new Error("ADMIN_DATABASE_ERROR");
    }

    if (!savedWebAppUrl && admin.role === "management") {
        const { data: urlRow } = await dbClient
            .from("google_script_config")
            .select("web_app_url")
            .eq("id", 1)
            .maybeSingle();

        savedWebAppUrl = urlRow?.web_app_url ?? null;
    }

    await writeAudit(
        admin.id,
        admin.nickname,
        "settings_update",
        [
            hasTheme ? "theme" : "",
            hasPassword ? "password" : "",
            hasWebAppUrl ? "web_app_url" : ""
        ].filter(Boolean).join(", "),
        "settings"
    );

    return {
        success: true,
        admin: updatedAdmin,
        settings: {
            theme: updatedAdmin.theme || "dark",
            web_app_url: admin.role === "management"
                ? savedWebAppUrl
                : null
        }
    };
}

async function getLogs(request: Request, body: any) {
    const { admin } = await authenticate(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    const limit = Math.min(
        Math.max(Number(body?.limit ?? 200), 1),
        200
    );

    const { data, error } = await db()
        .from("audit_logs")
        .select(
            "id,admin_id,nickname,action,details,page,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("LOGS ERROR", error);
        throw new Error("LOGS_DATABASE_ERROR");
    }

    return {
        success: true,
        logs: data ?? []
    };
}

async function auditLog(request: Request, body: any) {
    const { admin } = await authenticate(request);

    await writeAudit(
        admin.id,
        admin.nickname,
        String(body?.event_action ?? body?.action ?? "unknown"),
        body?.details == null ? null : String(body.details),
        body?.page == null ? null : String(body.page)
    );

    return { success: true };
}

const NORMATIVE_BUCKET = "admin-normatives";
const NORMATIVE_MIME_TYPES = new Set([
    "image/gif",
    "image/png",
    "image/jpeg"
]);
const NORMATIVE_MAX_SIZE = 10 * 1024 * 1024;

function sanitizeFilename(value: string): string {
    const normalized = value
        .normalize("NFKC")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^\.+/, "")
        .slice(0, 120);

    return normalized || "file";
}

function extensionForMimeType(mimeType: string): string {
    if (mimeType === "image/gif") return "gif";
    if (mimeType === "image/png") return "png";
    return "jpg";
}

async function storageRequest(
    path: string,
    init: RequestInit = {}
) {
    const headers = new Headers(
        init.headers || {}
    );

    headers.set(
        "Authorization",
        "Bearer " + DB_SECRET_KEY
    );
    headers.set(
        "apikey",
        DB_SECRET_KEY
    );

    return fetch(
        SUPABASE_URL +
            "/storage/v1/" +
            path,
        {
            ...init,
            headers
        }
    );
}

async function uploadNormative(
    request: Request,
    form: FormData
) {
    const { admin } = await authenticate(request);

    const files = form
        .getAll("file")
        .filter((item): item is File => item instanceof File && item.size > 0);

    if (!files.length) {
        throw new Error("NORMATIVE_FILE_REQUIRED");
    }

    if (files.length > 20) {
        throw new Error("NORMATIVE_TOO_MANY_FILES");
    }

    const date = String(form.get("date") ?? "").trim();
    const position = String(
        form.get("position") ?? admin.position ?? ""
    ).trim();
    const comment = String(form.get("comment") ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("NORMATIVE_DATE_REQUIRED");
    }

    const validated = files.map((file) => {
        const mimeType = String(file.type || "").toLowerCase();

        if (!NORMATIVE_MIME_TYPES.has(mimeType)) {
            throw new Error("NORMATIVE_MIME_NOT_ALLOWED");
        }

        if (file.size <= 0 || file.size > NORMATIVE_MAX_SIZE) {
            throw new Error("NORMATIVE_FILE_SIZE");
        }

        return {
            file,
            mimeType,
            extension: extensionForMimeType(mimeType),
            safeName: sanitizeFilename(file.name)
        };
    });

    const database = db();

    const { data: existing, error: existingError } = await database
        .from("normative_submissions")
        .select(
            "id,admin_id,nickname,submission_date,position,comment,status,reviewed_by,reviewed_at,review_comment,created_at,updated_at"
        )
        .eq("admin_id", admin.id)
        .eq("submission_date", date)
        .maybeSingle();

    if (existingError) {
        console.error("NORMATIVE SUBMISSION QUERY ERROR", existingError);
        throw new Error("NORMATIVES_DATABASE_ERROR");
    }

    if (existing?.status === "norm") {
        throw new Error("NORMATIVE_ALREADY_ACCEPTED");
    }

    let submissionId: number;

    if (existing) {
        submissionId = Number(existing.id);

        const { error: resetError } = await database
            .from("normative_submissions")
            .update({
                nickname: admin.nickname,
                position: position || null,
                comment: comment || null,
                status: "pending",
                reviewed_by: null,
                reviewed_at: null,
                review_comment: null,
                updated_at: new Date().toISOString()
            })
            .eq("id", submissionId);

        if (resetError) {
            console.error("NORMATIVE SUBMISSION UPDATE ERROR", resetError);
            throw new Error("DATABASE_ERROR");
        }
    } else {
        const { data: submission, error: submissionError } = await database
            .from("normative_submissions")
            .insert({
                admin_id: admin.id,
                nickname: admin.nickname,
                submission_date: date,
                position: position || null,
                comment: comment || null,
                status: "pending"
            })
            .select(
                "id,admin_id,nickname,submission_date,position,comment,status,created_at,updated_at"
            )
            .single();

        if (submissionError) {
            console.error("NORMATIVE SUBMISSION CREATE ERROR", submissionError);
            throw new Error("DATABASE_ERROR");
        }

        submissionId = Number(submission.id);
    }

    const uploadedPaths: string[] = [];
    const createdFiles: any[] = [];

    try {
        for (const item of validated) {
            const storagePath =
                admin.id +
                "/" +
                date +
                "/" +
                submissionId +
                "-" +
                crypto.randomUUID() +
                "-" +
                item.safeName.replace(
                    /\.[^.]+$/i,
                    "." + item.extension
                );

            const uploadResponse = await storageRequest(
                "object/" + NORMATIVE_BUCKET + "/" + storagePath,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": item.mimeType,
                        "x-upsert": "false",
                        "cache-control": "31536000"
                    },
                    body: await item.file.arrayBuffer()
                }
            );

            const uploadText = await uploadResponse.text();

            if (!uploadResponse.ok) {
                console.error(
                    "NORMATIVE STORAGE UPLOAD ERROR",
                    uploadResponse.status,
                    uploadText
                );
                throw new Error("NORMATIVE_STORAGE_UPLOAD_ERROR");
            }

            uploadedPaths.push(storagePath);

            const { data: createdFile, error: fileError } = await database
                .from("normative_files")
                .insert({
                    admin_id: admin.id,
                    nickname: admin.nickname,
                    submission_id: submissionId,
                    submission_date: date,
                    position: position || null,
                    original_filename: item.file.name,
                    storage_path: storagePath,
                    mime_type: item.mimeType,
                    size_bytes: item.file.size,
                    comment: comment || null
                })
                .select(
                    "id,submission_id,nickname,submission_date,position,original_filename,mime_type,size_bytes,comment,created_at"
                )
                .single();

            if (fileError) {
                console.error("NORMATIVE FILE DATABASE ERROR", fileError);
                throw new Error("DATABASE_ERROR");
            }

            createdFiles.push(createdFile);
        }
    } catch (error) {
        for (const storagePath of uploadedPaths) {
            await storageRequest(
                "object/" + NORMATIVE_BUCKET + "/" + storagePath,
                { method: "DELETE" }
            );
        }
        throw error;
    }

    const nowIso = new Date().toISOString();
    await database
        .from("normative_submissions")
        .update({
            updated_at: nowIso
        })
        .eq("id", submissionId);

    await writeAudit(
        admin.id,
        admin.nickname,
        "normative_created",
        "Норматив №" + submissionId +
            " • " + date +
            " • файлов: " + createdFiles.length,
        "normatives"
    );

    return {
        success: true,
        submission: {
            id: submissionId,
            admin_id: admin.id,
            nickname: admin.nickname,
            submission_date: date,
            position: position || null,
            comment: comment || null,
            status: "pending",
            created_at: existing?.created_at ?? nowIso,
            updated_at: nowIso
        },
        files: createdFiles
    };
}

async function listNormatives(
    request: Request,
    all: boolean
) {
    const { admin } =
        await authenticate(request);

    if (
        all &&
        admin.role !==
            "management"
    ) {
        throw new Error(
            "FORBIDDEN"
        );
    }

    let query =
        db()
            .from(
                "normative_files"
            )
            .select(
                "id,admin_id,nickname,submission_date,position,original_filename,mime_type,size_bytes,comment,created_at"
            )
            .order(
                "submission_date",
                {
                    ascending:
                        false
                }
            )
            .order(
                "id",
                {
                    ascending:
                        false
                }
            )
            .limit(200);

    if (!all) {
        query =
            query.eq(
                "admin_id",
                admin.id
            );
    }

    const { data, error } =
        await query;

    if (error) {
        console.error(
            "NORMATIVE LIST ERROR",
            error
        );

        throw new Error(
            "NORMATIVES_DATABASE_ERROR"
        );
    }

    return {
        success: true,
        normatives:
            data ?? []
    };
}

async function normativeUrl(
    request: Request,
    body: any
) {
    const { admin } =
        await authenticate(request);

    const id =
        Number(
            body?.id
        );

    if (
        !Number.isInteger(
            id
        ) ||
        id <= 0
    ) {
        throw new Error(
            "NORMATIVE_ID_REQUIRED"
        );
    }

    const { data, error } =
        await db()
            .from(
                "normative_files"
            )
            .select(
                "id,admin_id,storage_path,original_filename"
            )
            .eq(
                "id",
                id
            )
            .maybeSingle();

    if (error) {
        console.error(
            "NORMATIVE URL QUERY ERROR",
            error
        );

        throw new Error(
            "NORMATIVES_DATABASE_ERROR"
        );
    }

    if (!data) {
        throw new Error(
            "NORMATIVE_NOT_FOUND"
        );
    }

    if (
        admin.role !==
            "management" &&
        Number(data.admin_id) !==
            Number(admin.id)
    ) {
        throw new Error(
            "FORBIDDEN"
        );
    }

    const signResponse =
        await storageRequest(
            "object/sign/" +
                NORMATIVE_BUCKET +
                "/" +
                data.storage_path,
            {
                method:
                    "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify({
                        expiresIn:
                            3600
                    })
            }
        );

    const signText =
        await signResponse.text();

    if (
        !signResponse.ok
    ) {
        console.error(
            "NORMATIVE SIGN ERROR",
            signResponse.status,
            signText
        );

        throw new Error(
            "NORMATIVE_STORAGE_SIGN_ERROR"
        );
    }

    let signData: any = null;

    try {
        signData =
            JSON.parse(
                signText
            );
    } catch {
        throw new Error(
            "NORMATIVE_STORAGE_SIGN_ERROR"
        );
    }

    const signedPath =
        signData?.signedURL ??
        signData?.signedUrl ??
        signData?.signed_url;

    if (!signedPath) {
        throw new Error(
            "NORMATIVE_STORAGE_SIGN_ERROR"
        );
    }

    const url =
        signedPath.startsWith(
            "http"
        )
            ? signedPath
            : SUPABASE_URL +
              "/storage/v1" +
              signedPath;

    return {
        success: true,
        id,
        filename:
            data.original_filename,
        url
    };
}

async function signedNormativeUrl(storagePath: string): Promise<string> {
    const signResponse = await storageRequest(
        "object/sign/" + NORMATIVE_BUCKET + "/" + storagePath,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                expiresIn: 3600
            })
        }
    );

    const signText = await signResponse.text();

    if (!signResponse.ok) {
        console.error("NORMATIVE SIGN ERROR", signResponse.status, signText);
        throw new Error("NORMATIVE_STORAGE_SIGN_ERROR");
    }

    let signData: any;

    try {
        signData = JSON.parse(signText);
    } catch {
        throw new Error("NORMATIVE_STORAGE_SIGN_ERROR");
    }

    const signedPath =
        signData?.signedURL ??
        signData?.signedUrl ??
        signData?.signed_url;

    if (!signedPath) {
        throw new Error("NORMATIVE_STORAGE_SIGN_ERROR");
    }

    return signedPath.startsWith("http")
        ? signedPath
        : SUPABASE_URL + "/storage/v1" + signedPath;
}

async function normativesMine(request: Request) {
    const { admin } = await authenticate(request);
    const database = db();

    const { data: submissions, error: submissionError } = await database
        .from("normative_submissions")
        .select(
            "id,admin_id,nickname,submission_date,position,comment,status,reviewed_by,reviewed_at,review_comment,created_at,updated_at"
        )
        .eq("admin_id", admin.id)
        .order("submission_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(200);

    if (submissionError) {
        console.error("NORMATIVES MINE ERROR", submissionError);
        throw new Error("NORMATIVES_DATABASE_ERROR");
    }

    const { data: marks, error: marksError } = await database
        .from("normative_marks")
        .select(
            "id,nickname,submission_date,position,status,marked_by,marked_at,review_comment,created_at,updated_at"
        )
        .eq("nickname", admin.nickname)
        .order("submission_date", { ascending: false })
        .limit(200);

    if (marksError) {
        console.error("NORMATIVES MINE MARKS ERROR", marksError);
        throw new Error("NORMATIVES_DATABASE_ERROR");
    }

    const list: Array<any> =
        [...(submissions ?? [])];
    const byDate = new Map<string, any>();

    for (const submission of list) {
        byDate.set(String(submission.submission_date), submission);
    }

    for (const mark of marks ?? []) {
        const date = String(mark.submission_date);

        if (byDate.has(date)) {
            const submission = byDate.get(date);
            submission.status = mark.status;
            submission.reviewed_by = mark.marked_by;
            submission.reviewed_at = mark.marked_at;
            submission.review_comment = mark.review_comment;
            submission.updated_at = mark.updated_at;
        } else {
            list.push({
                id: null,
                admin_id: admin.id,
                nickname: admin.nickname,
                submission_date: mark.submission_date,
                position: mark.position || admin.position || null,
                comment: null,
                status: mark.status,
                reviewed_by: mark.marked_by,
                reviewed_at: mark.marked_at,
                review_comment: mark.review_comment,
                created_at: mark.created_at,
                updated_at: mark.updated_at,
                file_count: 0,
                marked_only: true
            });
        }
    }

    list.sort((a, b) => {
        const dateA = String(a.submission_date || "");
        const dateB = String(b.submission_date || "");
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return Number(b.id || 0) - Number(a.id || 0);
    });

    const ids = list
        .filter((item) => Number.isInteger(Number(item.id)) && Number(item.id) > 0)
        .map((item) => Number(item.id));

    let files: any[] = [];

    if (ids.length) {
        const { data, error } = await database
            .from("normative_files")
            .select(
                "id,submission_id,original_filename,mime_type,size_bytes,created_at"
            )
            .in("submission_id", ids)
            .order("id", { ascending: true });

        if (error) {
            console.error("NORMATIVE FILES MINE ERROR", error);
            throw new Error("NORMATIVES_DATABASE_ERROR");
        }

        files = data ?? [];
    }

    return {
        success: true,
        normatives: list.map((submission) => ({
            ...submission,
            file_count: submission.marked_only
                ? 0
                : files.filter(
                    (file) =>
                        Number(file.submission_id) === Number(submission.id)
                ).length
        }))
    };
}


async function normativesDaily(request: Request, body: any) {
    const { admin } = await authenticate(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    const date = String(body?.date ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("NORMATIVE_DATE_REQUIRED");
    }

    const database = db();

    const { data: adminsList, error: adminsError } = await database
        .from("admins")
        .select("id,nickname,position,is_active,role")
        .eq("role", "admin")
        .eq("is_active", true)
        .order("nickname", { ascending: true });

    if (adminsError) {
        console.error("NORMATIVES DAILY ADMINS ERROR", adminsError);
        throw new Error("ADMINS_DATABASE_ERROR");
    }

    const { data: submissions, error: submissionsError } = await database
        .from("normative_submissions")
        .select(
            "id,admin_id,nickname,submission_date,position,comment,status,reviewed_by,reviewed_at,review_comment,created_at,updated_at"
        )
        .eq("submission_date", date);

    if (submissionsError) {
        console.error("NORMATIVES DAILY SUBMISSIONS ERROR", submissionsError);
        throw new Error("NORMATIVES_DATABASE_ERROR");
    }

    const ids = (submissions ?? []).map((item) => Number(item.id));
    let fileCounts = new Map<number, number>();

    if (ids.length) {
        const { data: files, error: filesError } = await database
            .from("normative_files")
            .select("submission_id")
            .in("submission_id", ids);

        if (filesError) {
            console.error("NORMATIVES DAILY FILES ERROR", filesError);
            throw new Error("NORMATIVES_DATABASE_ERROR");
        }

        for (const file of files ?? []) {
            const id = Number(file.submission_id);
            fileCounts.set(id, (fileCounts.get(id) ?? 0) + 1);
        }
    }

    const byAdmin = new Map<number, any>();
    for (const submission of submissions ?? []) {
        byAdmin.set(Number(submission.admin_id), submission);
    }

    const { data: marks, error: marksError } = await database
        .from("normative_marks")
        .select("nickname,status,review_comment,marked_at,created_at,updated_at")
        .eq("submission_date", date);

    if (marksError) {
        console.error("NORMATIVES DAILY MARKS ERROR", marksError);
        throw new Error("NORMATIVES_DATABASE_ERROR");
    }

    const googleStatuses = new Map<string, any>();

    for (const mark of marks ?? []) {
        googleStatuses.set(
            String(mark.nickname ?? "").trim().toLowerCase(),
            mark
        );
    }

    const administrators = (adminsList ?? []).map((item) => {
        const submission = byAdmin.get(Number(item.id));
        const googleStatus =
            googleStatuses.get(
                String(item.nickname ?? "").trim().toLowerCase()
            );

        return {
            admin_id: Number(item.id),
            nickname: item.nickname,
            position: item.position,
            submission_id: submission ? Number(submission.id) : null,
            submission_date: date,
            status: googleStatus?.status ?? "not_submitted",
            comment: submission?.comment ?? null,
            review_comment: submission?.review_comment ?? googleStatus?.review_comment ?? null,
            reviewed_at: submission?.reviewed_at ?? googleStatus?.marked_at ?? null,
            created_at: submission?.created_at ?? googleStatus?.created_at ?? null,
            updated_at: submission?.updated_at ?? googleStatus?.updated_at ?? null,
            file_count: submission
                ? (fileCounts.get(Number(submission.id)) ?? 0)
                : 0
        };
    });

    await writeAudit(
        admin.id,
        admin.nickname,
        "normatives_daily",
        "Просмотр нормативов за " + date,
        "normatives"
    );

    return {
        success: true,
        date,
        administrators
    };
}

async function normativeDetail(request: Request, body: any) {
    const { admin } = await authenticate(request);

    const submissionId = Number(body?.submission_id ?? 0);
    const targetAdminId = Number(body?.admin_id ?? 0);
    const date = String(body?.date ?? "").trim();

    const database = db();
    let query = database
        .from("normative_submissions")
        .select(
            "id,admin_id,nickname,submission_date,position,comment,status,reviewed_by,reviewed_at,review_comment,created_at,updated_at"
        );

    if (Number.isInteger(submissionId) && submissionId > 0) {
        query = query.eq("id", submissionId);
    } else {
        if (!Number.isInteger(targetAdminId) || targetAdminId <= 0 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error("NORMATIVE_DETAIL_REQUIRED");
        }

        query = query
            .eq("admin_id", targetAdminId)
            .eq("submission_date", date);
    }

    const { data: submission, error: submissionError } = await query.maybeSingle();

    if (submissionError) {
        console.error("NORMATIVE DETAIL QUERY ERROR", submissionError);
        throw new Error("NORMATIVES_DATABASE_ERROR");
    }

    if (!submission) {
        if (
            admin.role !== "management" &&
            Number(targetAdminId) !== Number(admin.id)
        ) {
            throw new Error("FORBIDDEN");
        }

        return {
            success: true,
            submission: null,
            status: "not_submitted",
            files: []
        };
    }

    if (
        admin.role !== "management" &&
        Number(submission.admin_id) !== Number(admin.id)
    ) {
        throw new Error("FORBIDDEN");
    }

    const { data: files, error: filesError } = await database
        .from("normative_files")
        .select(
            "id,submission_id,original_filename,mime_type,size_bytes,comment,created_at,storage_path"
        )
        .eq("submission_id", submission.id)
        .order("id", { ascending: true });

    if (filesError) {
        console.error("NORMATIVE DETAIL FILES ERROR", filesError);
        throw new Error("NORMATIVES_DATABASE_ERROR");
    }

    const detailedFiles = [];

    for (const file of files ?? []) {
        detailedFiles.push({
            id: Number(file.id),
            submission_id: Number(file.submission_id),
            original_filename: file.original_filename,
            mime_type: file.mime_type,
            size_bytes: file.size_bytes,
            comment: file.comment,
            created_at: file.created_at,
            url: await signedNormativeUrl(file.storage_path)
        });
    }

    return {
        success: true,
        submission,
        status: submission.status,
        files: detailedFiles
    };
}

async function normativeReview(request: Request, body: any) {
    const { admin } = await authenticate(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    const status = String(body?.status ?? "").trim();
    const reviewComment = String(body?.review_comment ?? "").trim();
    const submissionId = Number(body?.submission_id ?? 0);
    const targetAdminId = Number(body?.admin_id ?? 0);
    const date = String(body?.date ?? "").trim();

    if (["norm", "rework", "no_norm", "inactive"].indexOf(status) === -1) {
        throw new Error("NORMATIVE_REVIEW_STATUS_REQUIRED");
    }

    if (
        (!Number.isInteger(submissionId) || submissionId <= 0) &&
        (!Number.isInteger(targetAdminId) ||
            targetAdminId <= 0 ||
            !/^\d{4}-\d{2}-\d{2}$/.test(date))
    ) {
        throw new Error("NORMATIVE_REVIEW_TARGET_REQUIRED");
    }

    const database = db();
    let submission: any = null;

    if (Number.isInteger(submissionId) && submissionId > 0) {
        const result = await database
            .from("normative_submissions")
            .select(
                "id,admin_id,nickname,submission_date,position,comment,status"
            )
            .eq("id", submissionId)
            .maybeSingle();

        if (result.error) {
            console.error("NORMATIVE REVIEW QUERY ERROR", result.error);
            throw new Error("NORMATIVES_DATABASE_ERROR");
        }

        submission = result.data;
    } else {
        const result = await database
            .from("normative_submissions")
            .select(
                "id,admin_id,nickname,submission_date,position,comment,status"
            )
            .eq("admin_id", targetAdminId)
            .eq("submission_date", date)
            .maybeSingle();

        if (result.error) {
            console.error("NORMATIVE REVIEW QUERY ERROR", result.error);
            throw new Error("NORMATIVES_DATABASE_ERROR");
        }

        submission = result.data;

        if (!submission && status !== "no_norm") {
            throw new Error("NORMATIVE_NOT_FOUND");
        }

        if (!submission && status === "no_norm") {
            const adminResult = await database
                .from("admins")
                .select("id,nickname,position,is_active")
                .eq("id", targetAdminId)
                .maybeSingle();

            if (adminResult.error) {
                console.error("NORMATIVE REVIEW ADMIN ERROR", adminResult.error);
                throw new Error("ADMINS_DATABASE_ERROR");
            }

            if (!adminResult.data || !adminResult.data.is_active) {
                throw new Error("ADMIN_NOT_FOUND");
            }

            const inserted = await database
                .from("normative_submissions")
                .insert({
                    admin_id: targetAdminId,
                    nickname: adminResult.data.nickname,
                    submission_date: date,
                    position: adminResult.data.position,
                    comment: null,
                    status: "no_norm",
                    reviewed_by: admin.id,
                    reviewed_at: new Date().toISOString(),
                    review_comment: reviewComment || "Норматив не сдан."
                })
                .select(
                    "id,admin_id,nickname,submission_date,position,comment,status,reviewed_by,reviewed_at,review_comment,created_at,updated_at"
                )
                .single();

            if (inserted.error) {
                console.error("NORMATIVE REVIEW ABSENCE INSERT ERROR", inserted.error);
                throw new Error("DATABASE_ERROR");
            }

            submission = inserted.data;
        }
    }

    if (!submission) {
        throw new Error("NORMATIVE_NOT_FOUND");
    }

    const reviewedAt = new Date().toISOString();

    if (status === "rework" && (!submission || Number(submission.id) <= 0)) {
        throw new Error("NORMATIVE_NOT_FOUND");
    }

    const { data: updated, error: updateError } = await database
        .from("normative_submissions")
        .update({
            status,
            reviewed_by: admin.id,
            reviewed_at: reviewedAt,
            review_comment: reviewComment || (
                status === "no_norm" ? "Норматив не сдан или не зачтён." : null
            ),
            updated_at: reviewedAt
        })
        .eq("id", submission.id)
        .select(
            "id,admin_id,nickname,submission_date,position,comment,status,reviewed_by,reviewed_at,review_comment,created_at,updated_at"
        )
        .single();

    if (updateError) {
        console.error("NORMATIVE REVIEW UPDATE ERROR", updateError);
        throw new Error("DATABASE_ERROR");
    }

    await writeAudit(
        admin.id,
        admin.nickname,
        "normative_review",
        "Норматив №" + updated.id + " • " + updated.nickname +
            " • " + updated.submission_date + " • статус: " + status,
        "normatives"
    );

    return {
        success: true,
        submission: updated
    };
}

async function notificationsList(request: Request) {
    const { admin } = await authenticate(request);
    const database = db();

    const { data: notifications, error: notificationsError } = await database
        .from("notifications")
        .select(
            "id,title,body,target_role,target_admin_id,created_by,expires_at,created_at"
        )
        .or(
            "target_role.eq.all,target_role.eq." +
                (admin.role === "management" ? "management" : "admin")
        )
        .or(
            "target_admin_id.is.null,target_admin_id.eq." + admin.id
        )
        .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);

    if (notificationsError) {
        console.error("NOTIFICATIONS LIST ERROR", notificationsError);
        throw new Error("NOTIFICATIONS_DATABASE_ERROR");
    }

    const list = notifications ?? [];
    const ids = list.map((item) => Number(item.id));
    let reads: any[] = [];

    if (ids.length) {
        const { data, error } = await database
            .from("notification_reads")
            .select("notification_id,read_at")
            .eq("admin_id", admin.id)
            .in("notification_id", ids);

        if (error) {
            console.error("NOTIFICATION READS ERROR", error);
            throw new Error("NOTIFICATIONS_DATABASE_ERROR");
        }

        reads = data ?? [];
    }

    const readMap = new Map<number, string>();
    for (const read of reads) {
        readMap.set(Number(read.notification_id), read.read_at);
    }

    return {
        success: true,
        notifications: list.map((item) => ({
            ...item,
            is_read: readMap.has(Number(item.id)),
            read_at: readMap.get(Number(item.id)) ?? null
        }))
    };
}

async function notificationCreate(request: Request, body: any) {
    const { admin } = await authenticate(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    const title = String(body?.title ?? "").trim();
    const message = String(body?.body ?? body?.text ?? "").trim();
    const targetRole = String(body?.target_role ?? "all").trim();
    const expiresAtRaw = String(body?.expires_at ?? "").trim();

    if (!title || !message) {
        throw new Error("NOTIFICATION_DATA_REQUIRED");
    }

    if (["all", "admin", "management"].indexOf(targetRole) === -1) {
        throw new Error("NOTIFICATION_TARGET_REQUIRED");
    }

    let expiresAt: string | null = null;

    if (expiresAtRaw) {
        const parsed = new Date(expiresAtRaw);

        if (!Number.isFinite(parsed.getTime())) {
            throw new Error("NOTIFICATION_EXPIRATION_INVALID");
        }

        expiresAt = parsed.toISOString();

        if (parsed.getTime() <= Date.now()) {
            throw new Error("NOTIFICATION_EXPIRATION_PAST");
        }
    }

    const { data, error } = await db()
        .from("notifications")
        .insert({
            title,
            body: message,
            target_role: targetRole,
            created_by: admin.id,
            expires_at: expiresAt
        })
        .select(
            "id,title,body,target_role,target_admin_id,created_by,expires_at,created_at"
        )
        .single();

    if (error) {
        console.error("NOTIFICATION CREATE ERROR", error);
        throw new Error("NOTIFICATIONS_DATABASE_ERROR");
    }

    await writeAudit(
        admin.id,
        admin.nickname,
        "notification_created",
        "Уведомление №" + data.id + " • получатели: " + targetRole,
        "notifications"
    );

    return {
        success: true,
        notification: data
    };
}

async function notificationRead(request: Request, body: any) {
    const { admin } = await authenticate(request);
    const notificationId = Number(body?.notification_id ?? 0);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
        throw new Error("NOTIFICATION_ID_REQUIRED");
    }

    const { data: notification, error: notificationError } = await db()
        .from("notifications")
        .select("id,target_role,target_admin_id,expires_at")
        .eq("id", notificationId)
        .maybeSingle();

    if (notificationError) {
        console.error("NOTIFICATION READ QUERY ERROR", notificationError);
        throw new Error("NOTIFICATIONS_DATABASE_ERROR");
    }

    if (!notification) {
        throw new Error("NOTIFICATION_NOT_FOUND");
    }

    const allowedRole =
        notification.target_role === "all" ||
        notification.target_role ===
            (admin.role === "management" ? "management" : "admin");

    const allowedTarget =
        notification.target_admin_id == null ||
        Number(notification.target_admin_id) === Number(admin.id);

    if (!allowedRole || !allowedTarget) {
        throw new Error("FORBIDDEN");
    }

    const { error } = await db()
        .from("notification_reads")
        .upsert(
            {
                notification_id: notificationId,
                admin_id: admin.id,
                read_at: new Date().toISOString()
            },
            { onConflict: "notification_id,admin_id" }
        );

    if (error) {
        console.error("NOTIFICATION READ ERROR", error);
        throw new Error("NOTIFICATIONS_DATABASE_ERROR");
    }

    return {
        success: true,
        notification_id: notificationId
    };
}

async function notificationDelete(request: Request, body: any) {
    const { admin } = await authenticate(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    const notificationId = Number(body?.notification_id ?? 0);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
        throw new Error("NOTIFICATION_ID_REQUIRED");
    }

    const { data, error } = await db()
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .select("id")
        .maybeSingle();

    if (error) {
        console.error("NOTIFICATION DELETE ERROR", error);
        throw new Error("NOTIFICATIONS_DATABASE_ERROR");
    }

    if (!data) {
        throw new Error("NOTIFICATION_NOT_FOUND");
    }

    await writeAudit(
        admin.id,
        admin.nickname,
        "notification_deleted",
        "Удалено уведомление №" + notificationId,
        "notifications"
    );

    return {
        success: true,
        notification_id: notificationId
    };
}

async function auditLogs(request: Request, body: any) {
    const { admin } = await authenticate(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    return getLogs(request, body);
}

async function fetchServerStats() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const upstream = await fetch(
            "https://blackrussia.online/api/gameservers/",
            {
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                cache: "no-store",
                signal: controller.signal
            }
        );

        if (!upstream.ok) {
            console.error("SERVER STATS UPSTREAM HTTP", upstream.status);
            throw new Error("SERVER_STATS_UPSTREAM");
        }

        const data = await upstream.json();

        const candidates = [
            Array.isArray(data) ? data : null,
            data?.servers,
            data?.data,
            data?.result,
            data?.gameservers,
            data?.response
        ];

        let servers = null;

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                servers = candidate;
                break;
            }
        }

        if (!servers) {
            if (data && typeof data === "object") {
                servers = [data];
            } else {
                throw new Error("SERVER_STATS_INVALID_RESPONSE");
            }
        }

        const normalized = servers.map((server: any) => {
            if (!server || typeof server !== "object") {
                return server;
            }

            const name =
                server.name ??
                server.title ??
                server.server_name ??
                server.serverName ??
                server.firstname ??
                server.display_name ??
                server.displayName;

            const online =
                server.online ??
                server.players ??
                server.player_count ??
                server.players_count ??
                server.current_players ??
                server.currentPlayers ??
                server.online_players;

            const maxOnline =
                server.max_online ??
                server.maxonline ??
                server.max_players ??
                server.maxPlayers ??
                server.slots;

            const x2 =
                server.x2 ??
                server.is_x2 ??
                server.isX2 ??
                server.multiplier;

            const color =
                server.color ??
                server.colour ??
                server.server_color ??
                server.serverColor ??
                server.status_color ??
                server.statusColor;

            return {
                ...server,
                ...(name !== undefined ? { name } : {}),
                ...(online !== undefined ? { online } : {}),
                ...(maxOnline !== undefined
                    ? { max_online: maxOnline }
                    : {}),
                ...(x2 !== undefined ? { x2 } : {}),
                ...(color !== undefined ? { color } : {})
            };
        });

        return {
            success: true,
            servers: normalized
        };
    } catch (error) {
        if (
            error instanceof Error &&
            error.name === "AbortError"
        ) {
            throw new Error(
                "SERVER_STATS_TIMEOUT"
            );
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function route(request: Request) {
    const contentType =
        request.headers.get("content-type") ?? "";

    if (
        contentType
            .toLowerCase()
            .startsWith("multipart/form-data")
    ) {
        const form = await request.formData();
        const action =
            String(
                form.get("action") ?? ""
            ).trim();

        if (action === "normative_upload") {
            return uploadNormative(
                request,
                form
            );
        }

        throw new Error("UNKNOWN_ACTION");
    }

    const body =
        await request.json().catch(() => ({}));

    const action =
        String(
            body?.action ?? ""
        ).trim();

    switch (action) {
        case "login":
            return login(request, body);
        case "access_candidates":
            return accessCandidates(request);
        case "access_list":
            return accessList(request);
        case "access_grant":
            return accessGrant(request, body);
        case "access_manage":
            return accessManage(request, body);
        case "me":
            return getMe(request);
        case "settings_get":
            return getSettings(request);
        case "settings_update":
            return updateSettings(request, body);
        case "logout":
            return logout(request);
        case "admins_list":
            return adminsList(request);
        case "create_admins":
            return createAdmins(request, body);
        case "logs":
            return getLogs(request, body);
        case "audit_log":
            return auditLog(request, body);
        case "notifications_list":
            return notificationsList(request);
        case "notification_create":
            return notificationCreate(request, body);
        case "notification_read":
            return notificationRead(request, body);
        case "notification_delete":
            return notificationDelete(request, body);
        case "audit_logs":
            return auditLogs(request, body);
        case "normatives_list":
            return listNormatives(
                request,
                false
            );
        case "normatives_all":
            return listNormatives(
                request,
                true
            );
        case "normatives_mine":
            return normativesMine(request);
        case "normatives_daily":
            return normativesDaily(request, body);
        case "normative_detail":
            return normativeDetail(request, body);
        case "normative_review":
            return normativeReview(request, body);
        case "normative_url":
            return normativeUrl(
                request,
                body
            );
        case "server_stats":
            await authenticate(request);
            return fetchServerStats();
        default:
            throw new Error("UNKNOWN_ACTION");
    }
}

const errorMap: Record<string, [number, string]> = {
    SERVER_CONFIGURATION_ERROR: [500, "Ошибка конфигурации сервера"],
    LOGIN_DATA_REQUIRED: [400, "Введите логин, пароль и устройство"],
    INVALID_CREDENTIALS: [401, "Неверный логин или пароль"],
    PASSWORD_NOT_CONFIGURED: [500, "Пароль аккаунта не настроен"],
    PASSWORD_DATA_REQUIRED: [400, "Укажите текущий и новый пароль"],
    PASSWORD_TOO_SHORT: [400, "Новый пароль должен содержать минимум 6 символов"],
    INVALID_THEME: [400, "Недопустимая тема"],
    INVALID_WEB_APP_URL: [400, "Укажите корректный URL Google Apps Script Web app (/exec)"],
    SETTINGS_DATA_REQUIRED: [400, "Нет настроек для изменения"],
    ACCOUNT_INACTIVE: [403, "Аккаунт не активирован"],
    ACCOUNT_BLOCKED: [403, "Аккаунт заблокирован"],
    DEVICE_MISMATCH: [403, "Аккаунт уже привязан к другому устройству"],
    UNAUTHORIZED: [401, "Авторизация не пройдена"],
    SESSION_EXPIRED: [401, "Сессия истекла"],
    SESSION_IDLE_EXPIRED: [401, "Сессия завершена из-за бездействия"],
    SESSION_DATABASE_ERROR: [500, "Ошибка проверки сессии"],
    SESSION_CREATE_ERROR: [500, "Не удалось создать сессию"],
    ADMIN_DATABASE_ERROR: [500, "Ошибка базы администраторов"],
    ADMIN_NOT_FOUND: [404, "Администратор не найден"],
    ADMIN_UPDATE_ERROR: [500, "Не удалось обновить администратора"],
    FORBIDDEN: [403, "Недостаточно прав"],
    ADMINS_ARRAY_REQUIRED: [400, "Не передан список администраторов"],
    TOO_MANY_ADMINS: [400, "Можно обработать не более 100 администраторов за раз"],
    SELF_ACCESS_FORBIDDEN: [400, "Нельзя заблокировать или удалить собственный доступ"],
    INVALID_ADMIN_DATA: [400, "Некорректные данные администратора"],
    INVALID_ROLE: [400, "Недопустимая роль"],
    DATABASE_ERROR: [500, "Ошибка базы данных"],
    ADMINS_DATABASE_ERROR: [500, "Не удалось получить список администраторов"],
    LOGS_DATABASE_ERROR: [500, "Не удалось получить журнал"],
    NOTIFICATIONS_DATABASE_ERROR: [500, "Не удалось загрузить уведомления"],
    NOTIFICATION_DATA_REQUIRED: [400, "Укажите заголовок и текст уведомления"],
    NOTIFICATION_TARGET_REQUIRED: [400, "Укажите получателей уведомления"],
    NOTIFICATION_EXPIRATION_INVALID: [400, "Некорректная дата окончания уведомления"],
    NOTIFICATION_EXPIRATION_PAST: [400, "Дата окончания уже прошла"],
    NOTIFICATION_ID_REQUIRED: [400, "Некорректный номер уведомления"],
    NOTIFICATION_NOT_FOUND: [404, "Уведомление не найдено"],
    SERVER_STATS_UPSTREAM: [502, "API серверов временно недоступно"],
    SERVER_STATS_TIMEOUT: [504, "API серверов не ответил вовремя"],
    SERVER_STATS_INVALID_RESPONSE: [502, "API серверов вернул некорректные данные"],
    APPS_SCRIPT_NOT_CONFIGURED: [503, "Google Apps Script не настроен"],
    APPS_SCRIPT_SECRET_NOT_CONFIGURED: [502, "Секрет Google Apps Script не настроен в Supabase"],
    APPS_SCRIPT_UNAUTHORIZED: [502, "Google Apps Script отклонил запрос: секреты не совпадают"],
    APPS_SCRIPT_SPREADSHEET_NOT_INITIALIZED: [502, "Google Apps Script не привязан к Google-таблице"],
    APPS_SCRIPT_INVALID_RESPONSE: [502, "Google Apps Script вернул некорректный ответ"],
    APPS_SCRIPT_HTTP_404: [502, "Google Apps Script вернул HTTP 404. Проверь веб-развёртывание"],
    APPS_SCRIPT_HTTP_403: [502, "Google Apps Script отклонил доступ к веб-приложению"],
    APPS_SCRIPT_HTTP_ERROR: [502, "Google Apps Script вернул HTTP-ошибку"],
    APPS_SCRIPT_TIMEOUT: [504, "Google Apps Script не ответил вовремя"],
    APPS_SCRIPT_ERROR: [502, "Ошибка Google Apps Script"],
    UNKNOWN_ACTION: [400, "Неизвестное действие"],
    NORMATIVE_FILE_REQUIRED: [400, "Файл не передан"],
    NORMATIVE_DATE_REQUIRED: [400, "Укажите дату норматива"],
    NORMATIVE_MIME_NOT_ALLOWED: [400, "Разрешены только GIF, PNG и JPEG"],
    NORMATIVE_FILE_SIZE: [400, "Размер файла должен быть от 1 байта до 10 МБ"],
    NORMATIVE_TOO_MANY_FILES: [400, "Можно отправить не более 20 файлов за один норматив"],
    NORMATIVE_ALREADY_ACCEPTED: [400, "Норматив за эту дату уже принят"],
    NORMATIVE_STORAGE_UPLOAD_ERROR: [502, "Не удалось сохранить файл"],
    NORMATIVES_DATABASE_ERROR: [500, "Не удалось получить нормативы"],
    NORMATIVE_ID_REQUIRED: [400, "Некорректный номер норматива"],
    NORMATIVE_NOT_FOUND: [404, "Норматив не найден"],
    NORMATIVE_STORAGE_SIGN_ERROR: [502, "Не удалось получить ссылку на файл"],
    NORMATIVE_DETAIL_REQUIRED: [400, "Не указаны данные норматива"],
    NORMATIVE_REVIEW_STATUS_REQUIRED: [400, "Укажите результат проверки"],
    NORMATIVE_REVIEW_TARGET_REQUIRED: [400, "Не указан администратор и дата норматива"]
};

Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", {
            status: 200,
            headers: corsHeaders
        });
    }

    if (request.method !== "POST") {
        return fail("METHOD_NOT_ALLOWED", 405, "Разрешён только POST");
    }

    try {
        return json(await route(request), 200);
    } catch (error) {
        const code =
            error instanceof Error
                ? error.message
                : "INTERNAL_ERROR";

        const item = errorMap[code];

        if (item) {
            return fail(code, item[0], item[1]);
        }

        console.error("VEb-tools error", error);
        return fail(
            "INTERNAL_ERROR",
            500,
            "Внутренняя ошибка сервера"
        );
    }
});
