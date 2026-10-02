import { getSupabase } from "./db.ts";
import { authenticate } from "./sessions.ts";

export async function writeAudit(
    adminId: number,
    nickname: string,
    action: string,
    details: string | null,
    page: string | null
) {
    const supabase = getSupabase();

    const { error } = await supabase
        .from("audit_logs")
        .insert({
            admin_id: adminId,
            nickname,
            action,
            details,
            page
        });

    if (error) {
        throw new Error("AUDIT_DATABASE_ERROR");
    }
}

export async function getAuditLogs(request: Request) {
    const { admin } = await authenticate(request);

    if (admin.role !== "management") {
        throw new Error("FORBIDDEN");
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
        .from("audit_logs")
        .select("id,admin_id,nickname,action,details,page,created_at")
        .order("created_at", { ascending: false })
        .limit(200);

    if (error) {
        throw new Error("LOGS_DATABASE_ERROR");
    }

    return {
        success: true,
        logs: data || []
    };
}
