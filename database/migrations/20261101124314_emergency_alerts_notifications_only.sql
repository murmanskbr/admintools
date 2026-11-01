-- Remove legacy emergency signals that were previously duplicated as appeal records.
DELETE FROM public.admin_requests
WHERE request_type = 'admin_action_block';

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
    v_admin_nickname text;
    v_notification_title text;
    v_target_role text;
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
        v_notification_title := 'Критическая ситуация на сервере';
        v_target_role := 'all';
    ELSE
        v_notification_title := 'СРОЧНО: блокировка админ-действий';
        v_target_role := 'management';
    END IF;

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
        v_notification_title,
        v_admin_nickname || ' сообщает:' || E'\n' || btrim(p_message),
        v_target_role,
        NULL,
        p_admin_id,
        'system',
        'emergency',
        '../pages/notifications.html',
        NULL
    )
    RETURNING to_jsonb(notifications) INTO v_notification;

    UPDATE public.admin_alert_cooldowns
       SET last_sent_at = v_now,
           updated_at = v_now
     WHERE admin_id = p_admin_id
       AND alert_type = p_alert_type;

    RETURN jsonb_build_object(
        'success', true,
        'alert_type', p_alert_type,
        'notification', v_notification,
        'next_allowed_at', v_now + interval '5 minutes'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_alert(bigint, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_alert(bigint, text, text, text) TO service_role;
