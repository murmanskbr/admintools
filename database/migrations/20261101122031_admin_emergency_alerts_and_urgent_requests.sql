ALTER TABLE public.admin_requests
    ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false;

ALTER TABLE public.admin_requests
    DROP CONSTRAINT IF EXISTS admin_requests_request_type_check;

ALTER TABLE public.admin_requests
    ADD CONSTRAINT admin_requests_request_type_check
    CHECK (request_type = ANY (ARRAY[
        'question'::text,
        'complaint'::text,
        'suggestion'::text,
        'admin_action_block'::text
    ]));

CREATE TABLE IF NOT EXISTS public.admin_alert_cooldowns (
    admin_id bigint NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
    alert_type text NOT NULL CHECK (alert_type IN ('critical_server', 'admin_actions_block')),
    last_sent_at timestamptz NOT NULL DEFAULT '-infinity'::timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (admin_id, alert_type)
);

ALTER TABLE public.admin_alert_cooldowns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_alert_cooldowns FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_alert_cooldowns TO service_role;

CREATE OR REPLACE FUNCTION public.create_admin_alert(
    p_admin_id bigint,
    p_nickname text,
    p_alert_type text,
    p_message text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now timestamptz := clock_timestamp();
    v_last_sent_at timestamptz;
    v_notification jsonb;
    v_request jsonb;
    v_admin_nickname text;
BEGIN
    IF p_alert_type NOT IN ('critical_server', 'admin_actions_block') THEN
        RAISE EXCEPTION 'ADMIN_ALERT_TYPE_INVALID';
    END IF;

    IF p_admin_id IS NULL OR p_admin_id <= 0 THEN
        RAISE EXCEPTION 'ADMIN_ALERT_FORBIDDEN';
    END IF;

    IF char_length(btrim(coalesce(p_message, ''))) = 0 THEN
        RAISE EXCEPTION 'ADMIN_ALERT_MESSAGE_REQUIRED';
    END IF;

    IF char_length(p_message) > 1000 THEN
        RAISE EXCEPTION 'ADMIN_ALERT_MESSAGE_TOO_LONG';
    END IF;

    SELECT nickname
      INTO v_admin_nickname
      FROM public.admins
     WHERE id = p_admin_id
       AND is_active = true
       AND blocked_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ADMIN_ALERT_FORBIDDEN';
    END IF;

    INSERT INTO public.admin_alert_cooldowns (admin_id, alert_type, last_sent_at)
    VALUES (p_admin_id, p_alert_type, '-infinity'::timestamptz)
    ON CONFLICT (admin_id, alert_type) DO NOTHING;

    SELECT last_sent_at
      INTO v_last_sent_at
      FROM public.admin_alert_cooldowns
     WHERE admin_id = p_admin_id
       AND alert_type = p_alert_type
     FOR UPDATE;

    IF v_last_sent_at > v_now - interval '5 minutes' THEN
        RAISE EXCEPTION 'ADMIN_ALERT_COOLDOWN';
    END IF;

    IF p_alert_type = 'critical_server' THEN
        INSERT INTO public.notifications (
            title,
            body,
            target_role,
            target_admin_id,
            created_by,
            source_type,
            kind,
            link,
            expires_at
        )
        VALUES (
            'Критическая ситуация на сервере',
            v_admin_nickname || ' сообщает:' || E'\n' || btrim(p_message),
            'all',
            NULL,
            p_admin_id,
            'system',
            'emergency',
            '../pages/notifications.html',
            NULL
        )
        RETURNING to_jsonb(notifications) INTO v_notification;
    ELSE
        INSERT INTO public.admin_requests (
            admin_id,
            nickname,
            request_type,
            message,
            status,
            urgent
        )
        VALUES (
            p_admin_id,
            v_admin_nickname,
            'admin_action_block',
            btrim(p_message),
            'pending',
            true
        )
        RETURNING to_jsonb(admin_requests) INTO v_request;
    END IF;

    UPDATE public.admin_alert_cooldowns
       SET last_sent_at = v_now,
           updated_at = v_now
     WHERE admin_id = p_admin_id
       AND alert_type = p_alert_type;

    RETURN jsonb_build_object(
        'success', true,
        'alert_type', p_alert_type,
        'notification', v_notification,
        'request', v_request,
        'next_allowed_at', v_now + interval '5 minutes'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_alert(bigint, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_alert(bigint, text, text, text) TO service_role;
