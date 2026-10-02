import { getSupabase } from "./db.ts";
import { hashPassword } from "./crypto.ts";
import { authenticate } from "./sessions.ts";

export async function getAdmins(request: Request) {
    const { admin: currentAdmin } = await authenticate(request);
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("admins")
        .select("id,login,nickname,role,position,is_active,created_at")
        .order("nickname", { ascending: true });

    if (error) {
        throw new Error("ADMINS_DATABASE_ERROR");
    }

    await supabase
        .from("audit_logs")
        .insert({
            admin_id: currentAdmin.id,
            nickname: currentAdmin.nickname,
            action: "admins_list",
            details: "Получен список администрации",
            page: "admins"
        });

    return {
        success: true,
        admins: data || []
    };
}

export async function createAdmins(request: Request, body: any) {
    const { admin: currentAdmin } = await authenticate(request);

    if (currentAdmin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    if (!Array.isArray(body?.admins) || body.admins.length === 0) {
        throw new Error("ADMINS_ARRAY_REQUIRED");
    }

    const records = [];

    for (const item of body.admins) {
        const login = String(item?.login || "").trim();
        const nickname = String(item?.nickname || "").trim();
        const password = String(item?.password || "");
        const role = String(item?.role || "admin").trim();
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

        const passwordHash = await hashPassword(password);

        records.push({
            login,
            nickname,
            password_hash: passwordHash,
            role,
            position,
            device_id: null,
            auth_token_hash: null,
            is_active: false
        });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("admins")
        .insert(records)
        .select("id,login,nickname,role,position,is_active");

    if (error) {
        throw new Error(error.message);
    }

    await supabase
        .from("audit_logs")
        .insert({
            admin_id: currentAdmin.id,
            nickname: currentAdmin.nickname,
            action: "create_admins",
            details: `Создано аккаунтов: ${records.length}`,
            page: "admins"
        });

    return {
        success: true,
        admins: data || []
    };
}
