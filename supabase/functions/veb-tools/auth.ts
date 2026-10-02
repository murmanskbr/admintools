import { getSupabase } from "./db.ts";
import { sha256, verifyPassword } from "./crypto.ts";
import { authenticate, createSession, revokeSession } from "./sessions.ts";
import { Admin } from "./types.ts";

export async function login(body: any) {
    const loginValue = String(body?.login || "").trim();
    const password = String(body?.password || "");
    const deviceId = String(body?.device_id || "").trim();

    if (!loginValue || !password || !deviceId) {
        throw new Error("LOGIN_DATA_REQUIRED");
    }

    const supabase = getSupabase();

    const { data: admin, error } = await supabase
        .from("admins")
        .select("id,login,nickname,password_hash,role,position,device_id,is_active,created_at")
        .eq("login", loginValue)
        .maybeSingle();

    if (error) {
        throw new Error("DATABASE_ERROR");
    }

    if (!admin) {
        throw new Error("INVALID_CREDENTIALS");
    }

    if (!admin.is_active) {
        throw new Error("INACTIVE");
    }

    if (!admin.password_hash) {
        throw new Error("PASSWORD_NOT_CONFIGURED");
    }

    const valid = await verifyPassword(password, admin.password_hash);

    if (!valid) {
        throw new Error("INVALID_CREDENTIALS");
    }

    const deviceHash = await sha256(deviceId);

    if (admin.device_id && admin.device_id !== deviceHash) {
        throw new Error("DEVICE_MISMATCH");
    }

    const result = await createSession(admin as Admin, deviceHash);

    await supabase
        .from("audit_logs")
        .insert({
            admin_id: admin.id,
            nickname: admin.nickname,
            action: "login",
            details: "Вход в веб-панель",
            page: "login"
        });

    return {
        success: true,
        token: result.token,
        session: result.session,
        admin: {
            id: admin.id,
            login: admin.login,
            nickname: admin.nickname,
            role: admin.role,
            position: admin.position,
            is_active: admin.is_active
        }
    };
}

export async function getMe(request: Request) {
    const { admin, session } = await authenticate(request);

    return {
        success: true,
        admin: {
            id: admin.id,
            login: admin.login,
            nickname: admin.nickname,
            role: admin.role,
            position: admin.position,
            is_active: admin.is_active
        },
        session: {
            id: session.id,
            expires_at: session.expires_at,
            last_activity_at: session.last_activity_at
        }
    };
}

export async function logout(request: Request) {
    const { admin, session } = await authenticate(request);
    const supabase = getSupabase();

    await revokeSession(session.id);

    await supabase
        .from("admins")
        .update({
            auth_token_hash: null
        })
        .eq("id", admin.id);

    await supabase
        .from("audit_logs")
        .insert({
            admin_id: admin.id,
            nickname: admin.nickname,
            action: "logout",
            details: "Выход из веб-панели",
            page: "logout"
        });

    return {
        success: true
    };
}
