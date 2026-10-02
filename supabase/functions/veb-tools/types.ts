export interface Admin {
    id: number;
    login: string | null;
    nickname: string;
    password_hash: string | null;
    role: string;
    position: string | null;
    device_id: string | null;
    auth_token_hash: string | null;
    is_active: boolean;
    created_at: string;
}

export interface Session {
    id: number;
    admin_id: number;
    token_hash: string;
    device_id: string | null;
    expires_at: string;
    last_activity_at: string | null;
    created_at: string;
    revoked_at: string | null;
}

export interface AuthContext {
    admin: Admin;
    session: Session;
    token: string;
}
