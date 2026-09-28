-- Starter Message masters switched greetings from {{client_name}} to
-- {{first_name}} (feb0e00e) so couples and primary-only leads both open with
-- the recipient's first name. Provision skips existing venue copies by
-- source_master_key, so Sandbox (and other) copies still said
-- "Hi {{client_name}}," → "Hi Betty Rubble,".
-- Align MSG-* venue copies (and not-yet-sent scheduled bodies) with masters.

update public.message_templates
set email_body = replace(email_body, 'Hi {{client_name}},', 'Hi {{first_name}},')
where source_master_key like 'MSG-%'
  and email_body like '%Hi {{client_name}},%';

update public.scheduled_messages
set body = replace(body, 'Hi {{client_name}},', 'Hi {{first_name}},')
where status = 'scheduled'
  and body like '%Hi {{client_name}},%';
