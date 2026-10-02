import { getSupabase } from "./db.ts";
import { generateToken, sha256 } from "./crypto.ts";
import { Admin, AuthContext, Session } from "./types.ts";

const IDLE_TIMEOUT_SECONDS = 180;
const SESSION_LIFETIME_SECONDS = 86400;

function getBearerToken(request: Request): string | null {
    const header = request.headers.get("authorization");

    if (!header) {
        return null;
    }

    const parts = header.trim().split(/\s+/);

    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
        return null;
    }

    return parts[1];
}

export async function authenticate(request: Request): Promise<AuthContext> {
    const token = getBearerToken(request);

    if (!token) {
        throw new Error("UNAUTHORIZED");
    }

    const tokenHash = await sha256(token);
    const supabase = getSupabase();

    const { data: session, error: sessionError } = await supabase
        .from("admin_sessions")
        .select("id,admin_id,token_hash,device_id,expires_at,last_activity_at,created_at,revoked_at")
        .eq("token_hash", tokenHash)
        .is("revoked_at", null)
        .maybeSingle();

    if (sessionError) {
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

    if (session.last_activity_at) {
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

    if (session.device_id && session.device_id !== requestDeviceId) {
        throw new Error("DEVICE_MISMATCH");
    }

    const { data: admin, error: adminError } = await supabase
        .from("admins")
        .select("id,login,nickname,password_hash,role,position,device_id,is_active,created_at")
        .eq("id", session.admin_id)
        .maybeSingle();

    if (adminError) {
        throw new Error("ADMIN_DATABASE_ERROR");
    }

    if (!admin) {
        throw new Error("ADMIN_NOT_FOUND");
    }

    if (!admin.is_active) {
        throw new Error("INACTIVE");
    }

    if (admin.device_id && admin.device_id !== requestDeviceId) {
        throw new Error("DEVICE_MISMATCH");
    }

    await supabase
        .from("admin_sessions")
        .update({
            last_activity_at: new Date().toISOString()
        })
        .eq("id", session.id);

    return {
        admin: admin as Admin,
        session: session as Session,
        token
    };
}

export async function createSession(admin: Admin, deviceHash: string) {
    const supabase = getSupabase();
    const token = generateToken();
    const tokenHash = await sha256(token);

    const now = new Date();
    const expiresAt = new Date(
        now.getTime() + SESSION_LIFETIME_SECONDS * 1000
    );

    await supabase
        .from("admin_sessions")
        .update({
            revoked_at: now.toISOString()
        })
        .eq("admin_id", admin.id)
        .is("revoked_at", null);

    const { error: adminError } = await supabase
        .from("admins")
        .update({
            device_id: admin.device_id || deviceHash,
            auth_token_hash: tokenHash
        })
        .eq("id", admin.id);

    if (adminError) {
        throw new Error("ADMIN_UPDATE_ERROR");
    }

    const { data: session, error: sessionError } = await supabase
        .from("admin_sessions")
        .insert({
            admin_id: admin.id,
            token_hash: tokenHash,
            device_id: admin.device_id || deviceHash,
            expires_at: expiresAt.toISOString(),
            last_activity_at: now.toISOString()
        })
        .select("id,expires_at,last_activity_at,created_at")
        .single();

    if (sessionError) {
        throw new Error("SESSION_CREATE_ERROR");
    }

    return { token, session };
}

export async function revokeSession(sessionId: number) {
    const supabase = getSupabase();

    await supabase
        .from("admin_sessions")
        .update({
            revoked_at: new Date().toISOString()
        })
        .eq("id", sessionId);
}
