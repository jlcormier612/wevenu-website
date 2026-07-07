-- Sprint 95: Couple ↔ Venue in-app messaging
--
-- Separate from the existing message_threads/messages tables which handle
-- outbound email/SMS via Resend. This schema is purpose-built for
-- bidirectional in-app chat between a venue coordinator and a couple.
--
-- Design principles:
--   • One thread per client (Phase 1). Thread owns the conversation.
--   • Read status tracked per side (venue_read_at / couple_read_at).
--   • Attachments are separate rows so message body stays clean.
--   • Portal access via token; token → portal_session → client → thread.
--   • All venue-side queries use RLS on venue_id; portal queries go through
--     security-definer RPCs that validate the token first.

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE public.couple_threads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  client_id       uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  -- Denormalised unread counts for fast badge queries. Updated by trigger.
  venue_unread    int         NOT NULL DEFAULT 0,
  couple_unread   int         NOT NULL DEFAULT 0,
  UNIQUE (venue_id, client_id)
);

CREATE TABLE public.couple_messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       uuid        NOT NULL REFERENCES public.couple_threads(id) ON DELETE CASCADE,
  venue_id        uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  sender_type     text        NOT NULL CHECK (sender_type IN ('venue', 'couple')),
  body            text        NOT NULL CHECK (char_length(body) > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Null = unread by that side
  venue_read_at   timestamptz,
  couple_read_at  timestamptz
);

CREATE TABLE public.couple_message_attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid        NOT NULL REFERENCES public.couple_messages(id) ON DELETE CASCADE,
  file_url    text        NOT NULL,
  file_name   text        NOT NULL,
  file_size   bigint,
  mime_type   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX couple_threads_venue_id_idx         ON public.couple_threads(venue_id);
CREATE INDEX couple_threads_last_message_at_idx  ON public.couple_threads(last_message_at DESC NULLS LAST);
CREATE INDEX couple_messages_thread_id_idx       ON public.couple_messages(thread_id, created_at);
CREATE INDEX couple_message_attachments_msg_idx  ON public.couple_message_attachments(message_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.couple_threads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_message_attachments ENABLE ROW LEVEL SECURITY;

-- Venue coordinators: access threads/messages for their own venue
CREATE POLICY "venue_own_threads" ON public.couple_threads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.id = venue_id AND v.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "venue_own_messages" ON public.couple_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.venues v
      WHERE v.id = venue_id AND v.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "venue_own_message_attachments" ON public.couple_message_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.couple_messages cm
      JOIN public.venues v ON v.id = cm.venue_id
      WHERE cm.id = message_id AND v.owner_user_id = auth.uid()
    )
  );

-- ── Trigger: maintain denormalised unread counts + last_message_at ───────────

CREATE OR REPLACE FUNCTION public.update_couple_thread_on_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.couple_threads SET
    last_message_at = NEW.created_at,
    venue_unread  = CASE WHEN NEW.sender_type = 'couple'
                         THEN venue_unread + 1 ELSE venue_unread END,
    couple_unread = CASE WHEN NEW.sender_type = 'venue'
                         THEN couple_unread + 1 ELSE couple_unread END
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER couple_message_inserted
  AFTER INSERT ON public.couple_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_couple_thread_on_message();

-- ── RPC: venue inbox (all threads with latest message preview) ────────────────

CREATE OR REPLACE FUNCTION public.get_couple_inbox()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  SELECT v.id INTO v_venue_id
  FROM public.venues v
  WHERE v.owner_user_id = auth.uid()
  LIMIT 1;

  IF v_venue_id IS NULL THEN
    RETURN '{"error":"unauthorized"}'::jsonb;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'threads', COALESCE(jsonb_agg(t ORDER BY t.last_message_at DESC NULLS LAST), '[]'::jsonb),
      'total_unread', (SELECT COALESCE(SUM(venue_unread), 0) FROM public.couple_threads WHERE venue_id = v_venue_id)
    )
    FROM (
      SELECT
        ct.id,
        ct.client_id,
        ct.last_message_at,
        ct.venue_unread,
        ct.couple_unread,
        c.first_name,
        c.last_name,
        c.partner_first_name,
        c.partner_last_name,
        c.event_date,
        c.event_type,
        -- Latest message preview
        (
          SELECT jsonb_build_object(
            'body',        cm.body,
            'sender_type', cm.sender_type,
            'created_at',  cm.created_at
          )
          FROM public.couple_messages cm
          WHERE cm.thread_id = ct.id
          ORDER BY cm.created_at DESC
          LIMIT 1
        ) AS latest_message
      FROM public.couple_threads ct
      JOIN public.clients c ON c.id = ct.client_id
      WHERE ct.venue_id = v_venue_id
      ORDER BY ct.last_message_at DESC NULLS LAST
    ) t
  );
END;
$$;

-- ── RPC: get thread messages (venue side) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_couple_thread(p_thread_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  SELECT v.id INTO v_venue_id
  FROM public.venues v
  WHERE v.owner_user_id = auth.uid()
  LIMIT 1;

  IF v_venue_id IS NULL THEN
    RETURN '{"error":"unauthorized"}'::jsonb;
  END IF;

  -- Verify this thread belongs to the venue
  IF NOT EXISTS (
    SELECT 1 FROM public.couple_threads
    WHERE id = p_thread_id AND venue_id = v_venue_id
  ) THEN
    RETURN '{"error":"not_found"}'::jsonb;
  END IF;

  -- Mark all couple-sent messages as read by venue
  UPDATE public.couple_messages
  SET venue_read_at = now()
  WHERE thread_id = p_thread_id
    AND sender_type = 'couple'
    AND venue_read_at IS NULL;

  -- Reset venue unread count
  UPDATE public.couple_threads
  SET venue_unread = 0
  WHERE id = p_thread_id;

  RETURN (
    SELECT jsonb_build_object(
      'thread', row_to_json(ct.*),
      'messages', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',             cm.id,
              'sender_type',    cm.sender_type,
              'body',           cm.body,
              'created_at',     cm.created_at,
              'venue_read_at',  cm.venue_read_at,
              'couple_read_at', cm.couple_read_at,
              'attachments',    COALESCE(
                (
                  SELECT jsonb_agg(row_to_json(a.*))
                  FROM public.couple_message_attachments a
                  WHERE a.message_id = cm.id
                ),
                '[]'::jsonb
              )
            )
            ORDER BY cm.created_at ASC
          )
          FROM public.couple_messages cm
          WHERE cm.thread_id = p_thread_id
        ),
        '[]'::jsonb
      )
    )
    FROM public.couple_threads ct
    JOIN public.clients c ON c.id = ct.client_id
    WHERE ct.id = p_thread_id
  );
END;
$$;

-- ── RPC: venue sends a message ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_couple_message(
  p_thread_id uuid,
  p_body      text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_venue_id uuid;
  v_msg_id   uuid;
BEGIN
  SELECT v.id INTO v_venue_id
  FROM public.venues v
  WHERE v.owner_user_id = auth.uid()
  LIMIT 1;

  IF v_venue_id IS NULL THEN
    RETURN '{"ok":false,"error":"unauthorized"}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.couple_threads
    WHERE id = p_thread_id AND venue_id = v_venue_id
  ) THEN
    RETURN '{"ok":false,"error":"not_found"}'::jsonb;
  END IF;

  IF length(trim(p_body)) = 0 THEN
    RETURN '{"ok":false,"error":"empty_body"}'::jsonb;
  END IF;

  INSERT INTO public.couple_messages (thread_id, venue_id, sender_type, body)
  VALUES (p_thread_id, v_venue_id, 'venue', trim(p_body))
  RETURNING id INTO v_msg_id;

  RETURN jsonb_build_object('ok', true, 'message_id', v_msg_id);
END;
$$;

-- ── RPC: ensure thread exists for a client (venue creates on first message) ───

CREATE OR REPLACE FUNCTION public.ensure_couple_thread(p_client_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_venue_id  uuid;
  v_thread_id uuid;
BEGIN
  SELECT v.id INTO v_venue_id
  FROM public.venues v
  WHERE v.owner_user_id = auth.uid()
  LIMIT 1;

  IF v_venue_id IS NULL THEN
    RETURN '{"ok":false,"error":"unauthorized"}'::jsonb;
  END IF;

  -- Insert or resolve existing thread
  INSERT INTO public.couple_threads (venue_id, client_id)
  VALUES (v_venue_id, p_client_id)
  ON CONFLICT (venue_id, client_id) DO NOTHING
  RETURNING id INTO v_thread_id;

  IF v_thread_id IS NULL THEN
    SELECT id INTO v_thread_id
    FROM public.couple_threads
    WHERE venue_id = v_venue_id AND client_id = p_client_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'thread_id', v_thread_id);
END;
$$;

-- ── RPC: portal — get couple's thread ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_portal_messages(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id uuid;
  v_venue_id  uuid;
  v_thread_id uuid;
BEGIN
  SELECT ps.client_id, ps.venue_id
  INTO v_client_id, v_venue_id
  FROM public.client_portal_sessions ps
  WHERE ps.access_token = p_token
    AND (ps.expires_at IS NULL OR ps.expires_at > now())
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN '{"error":"invalid_token"}'::jsonb;
  END IF;

  -- Get or create thread
  INSERT INTO public.couple_threads (venue_id, client_id)
  VALUES (v_venue_id, v_client_id)
  ON CONFLICT (venue_id, client_id) DO NOTHING;

  SELECT id INTO v_thread_id
  FROM public.couple_threads
  WHERE venue_id = v_venue_id AND client_id = v_client_id;

  -- Mark all venue-sent messages as read by couple
  UPDATE public.couple_messages
  SET couple_read_at = now()
  WHERE thread_id = v_thread_id
    AND sender_type = 'venue'
    AND couple_read_at IS NULL;

  UPDATE public.couple_threads
  SET couple_unread = 0
  WHERE id = v_thread_id;

  RETURN (
    SELECT jsonb_build_object(
      'thread_id', v_thread_id,
      'messages',  COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id',             cm.id,
              'sender_type',    cm.sender_type,
              'body',           cm.body,
              'created_at',     cm.created_at,
              'couple_read_at', cm.couple_read_at,
              'attachments',    COALESCE(
                (
                  SELECT jsonb_agg(row_to_json(a.*))
                  FROM public.couple_message_attachments a
                  WHERE a.message_id = cm.id
                ),
                '[]'::jsonb
              )
            )
            ORDER BY cm.created_at ASC
          )
          FROM public.couple_messages cm
          WHERE cm.thread_id = v_thread_id
        ),
        '[]'::jsonb
      )
    )
  );
END;
$$;

-- ── RPC: portal — couple sends a message ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.send_portal_message(
  p_token text,
  p_body  text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id uuid;
  v_venue_id  uuid;
  v_thread_id uuid;
  v_msg_id    uuid;
BEGIN
  SELECT ps.client_id, ps.venue_id
  INTO v_client_id, v_venue_id
  FROM public.client_portal_sessions ps
  WHERE ps.access_token = p_token
    AND (ps.expires_at IS NULL OR ps.expires_at > now())
  LIMIT 1;

  IF v_client_id IS NULL THEN
    RETURN '{"ok":false,"error":"invalid_token"}'::jsonb;
  END IF;

  IF length(trim(p_body)) = 0 THEN
    RETURN '{"ok":false,"error":"empty_body"}'::jsonb;
  END IF;

  -- Ensure thread exists
  INSERT INTO public.couple_threads (venue_id, client_id)
  VALUES (v_venue_id, v_client_id)
  ON CONFLICT (venue_id, client_id) DO NOTHING;

  SELECT id INTO v_thread_id
  FROM public.couple_threads
  WHERE venue_id = v_venue_id AND client_id = v_client_id;

  INSERT INTO public.couple_messages (thread_id, venue_id, sender_type, body)
  VALUES (v_thread_id, v_venue_id, 'couple', trim(p_body))
  RETURNING id INTO v_msg_id;

  RETURN jsonb_build_object('ok', true, 'message_id', v_msg_id);
END;
$$;

-- ── RPC: venue inbox unread count (for sidebar badge) ────────────────────────

CREATE OR REPLACE FUNCTION public.get_couple_unread_count()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_venue_id uuid;
  v_count    int;
BEGIN
  SELECT v.id INTO v_venue_id
  FROM public.venues v
  WHERE v.owner_user_id = auth.uid()
  LIMIT 1;

  IF v_venue_id IS NULL THEN
    RETURN '{"count":0}'::jsonb;
  END IF;

  SELECT COALESCE(SUM(venue_unread), 0)
  INTO v_count
  FROM public.couple_threads
  WHERE venue_id = v_venue_id;

  RETURN jsonb_build_object('count', v_count);
END;
$$;
