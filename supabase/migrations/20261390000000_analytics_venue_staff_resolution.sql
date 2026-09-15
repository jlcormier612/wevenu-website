-- ============================================================================
-- Engineering cleanup — venue-staff resolution for analytics / Luv RPCs.
--
-- get_venue_analytics(), get_client_health_scores(), save_luv_rollup(), and
-- get_luv_rollups() still resolved the venue via venues.owner_user_id =
-- auth.uid(). Managers (and other accepted venue staff) therefore received
-- not_found / empty results even though current_user_venue_id() already
-- resolves their venue correctly for the rest of the product.
--
-- Metric formulas are unchanged — only venue resolution is updated.
-- ============================================================================

do $patch$
declare
  def text;
  proc regprocedure;
  procs regprocedure[] := array[
    'public.get_venue_analytics()'::regprocedure,
    'public.get_client_health_scores()'::regprocedure,
    'public.save_luv_rollup(jsonb, jsonb, text)'::regprocedure,
    'public.get_luv_rollups(integer)'::regprocedure
  ];
begin
  foreach proc in array procs loop
    def := pg_get_functiondef(proc);
    -- Normalized CREATE OR REPLACE so re-runs are safe.
    def := regexp_replace(def, '^CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION');

    -- Multi-line owner lookup used by get_venue_analytics / get_client_health_scores.
    def := regexp_replace(
      def,
      'select id into v_venue_id[[:space:]]+from public\.venues[[:space:]]+where owner_user_id = auth\.uid\(\);[[:space:]]+if not found then return jsonb_build_object\(''error'', ''not_found''\); end if;',
      'v_venue_id := public.current_user_venue_id(); if v_venue_id is null then return jsonb_build_object(''error'', ''not_found''); end if;',
      'gi'
    );

    -- Single-line owner lookup used by save_luv_rollup / get_luv_rollups.
    def := regexp_replace(
      def,
      'select id into v_venue_id from public\.venues where owner_user_id = auth\.uid\(\);[[:space:]]+if not found then return jsonb_build_object\(''error'', ''not_found''\); end if;',
      'v_venue_id := public.current_user_venue_id(); if v_venue_id is null then return jsonb_build_object(''error'', ''not_found''); end if;',
      'gi'
    );

    -- get_luv_rollups empty-rollups variant.
    def := regexp_replace(
      def,
      'select id into v_venue_id from public\.venues where owner_user_id = auth\.uid\(\);[[:space:]]+if not found then return jsonb_build_object\(''rollups'', ''\[\]''::jsonb\); end if;',
      'v_venue_id := public.current_user_venue_id(); if v_venue_id is null then return jsonb_build_object(''rollups'', ''[]''::jsonb); end if;',
      'gi'
    );

    if position('current_user_venue_id()' in def) = 0 then
      raise exception 'Failed to rewrite venue resolution in %', proc;
    end if;

    execute def;
  end loop;
end;
$patch$;
