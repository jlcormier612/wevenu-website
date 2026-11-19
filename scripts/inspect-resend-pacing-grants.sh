#!/usr/bin/env bash
# Read-only inspection of acquire_resend_send_slot privileges on Sandbox.
# Usage: bash scripts/inspect-resend-pacing-grants.sh "$SANDBOX_DB_URL"
# Never prints the connection string. Never mutates the database.
set -euo pipefail

CONN="${1:-${SANDBOX_DB_URL:-}}"
if [ -z "$CONN" ]; then
  echo "usage: $0 <SANDBOX_DB_URL>" >&2
  exit 1
fi

psql "$CONN" -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
\echo === acquire_resend_send_slot overloads ===
select p.oid::regprocedure as signature,
       pg_get_userbyid(p.proowner) as owner,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'acquire_resend_send_slot'
order by 1;

\echo === ACL (proacl) ===
select p.oid::regprocedure as signature,
       coalesce(p.proacl::text, '(default/null ACL)') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'acquire_resend_send_slot'
order by 1;

\echo === has_function_privilege ===
select role,
       has_function_privilege(role, 'public.acquire_resend_send_slot(text, integer, integer, integer, bigint)', 'execute') as can_execute
from (values ('anon'), ('authenticated'), ('service_role'), ('postgres')) as roles(role);

\echo === grants via information_schema (routine privileges) ===
select grantee, privilege_type, is_grantable
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'acquire_resend_send_slot'
order by grantee, privilege_type;
SQL
