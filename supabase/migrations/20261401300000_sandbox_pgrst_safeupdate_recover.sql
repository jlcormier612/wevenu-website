-- Placeholder: cannot ALTER session_preload_libraries on hosted Sandbox
-- (permission denied). Left as a no-op reload signal only.

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
select 1;
