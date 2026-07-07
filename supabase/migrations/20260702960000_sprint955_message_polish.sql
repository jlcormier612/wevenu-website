-- Sprint 95.5: Messaging Polish — attachments + storage bucket
--
-- Changes:
--   1. Relax body constraint to allow empty string (attachment-only messages)
--   2. Storage bucket for message attachments (public, image + doc types)
--   3. add_message_attachment() RPC — venue side
--   4. add_portal_message_attachment() RPC — portal/couple side

-- ── 1. Relax body constraint ──────────────────────────────────────────────────

ALTER TABLE public.couple_messages
  DROP CONSTRAINT IF EXISTS couple_messages_body_check;

-- ── 2. Storage bucket ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'couple-messages',
  'couple-messages',
  true,
  20971520,  -- 20 MB
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload; public read for delivery
CREATE POLICY "couple_messages_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'couple-messages');

CREATE POLICY "couple_messages_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'couple-messages');

-- ── 3. RPC: venue adds an attachment to a message ─────────────────────────────

CREATE OR REPLACE FUNCTION public.add_message_attachment(
  p_message_id  uuid,
  p_file_url    text,
  p_file_name   text,
  p_file_size   bigint  DEFAULT NULL,
  p_mime_type   text    DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_venue_id uuid;
  v_att_id   uuid;
BEGIN
  SELECT v.id INTO v_venue_id
  FROM public.venues v
  WHERE v.owner_user_id = auth.uid()
  LIMIT 1;

  IF v_venue_id IS NULL THEN
    RETURN '{"ok":false,"error":"unauthorized"}'::jsonb;
  END IF;

  -- Verify the message belongs to this venue
  IF NOT EXISTS (
    SELECT 1 FROM public.couple_messages
    WHERE id = p_message_id AND venue_id = v_venue_id
  ) THEN
    RETURN '{"ok":false,"error":"not_found"}'::jsonb;
  END IF;

  INSERT INTO public.couple_message_attachments
    (message_id, file_url, file_name, file_size, mime_type)
  VALUES
    (p_message_id, p_file_url, p_file_name, p_file_size, p_mime_type)
  RETURNING id INTO v_att_id;

  RETURN jsonb_build_object('ok', true, 'attachment_id', v_att_id);
END;
$$;

-- ── 4. RPC: portal (couple) adds an attachment ───────────────────────────────

CREATE OR REPLACE FUNCTION public.add_portal_message_attachment(
  p_token       text,
  p_message_id  uuid,
  p_file_url    text,
  p_file_name   text,
  p_file_size   bigint  DEFAULT NULL,
  p_mime_type   text    DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id uuid;
  v_venue_id  uuid;
  v_att_id    uuid;
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

  -- Verify message belongs to this couple's thread
  IF NOT EXISTS (
    SELECT 1 FROM public.couple_messages cm
    JOIN public.couple_threads ct ON ct.id = cm.thread_id
    WHERE cm.id = p_message_id
      AND ct.client_id = v_client_id
      AND ct.venue_id  = v_venue_id
  ) THEN
    RETURN '{"ok":false,"error":"not_found"}'::jsonb;
  END IF;

  INSERT INTO public.couple_message_attachments
    (message_id, file_url, file_name, file_size, mime_type)
  VALUES
    (p_message_id, p_file_url, p_file_name, p_file_size, p_mime_type)
  RETURNING id INTO v_att_id;

  RETURN jsonb_build_object('ok', true, 'attachment_id', v_att_id);
END;
$$;
