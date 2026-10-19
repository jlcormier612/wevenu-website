-- Marketplace lead-source vocabulary for automatic email-forward attribution.
-- the_knot and wedding_wire already exist as manual_label entries. Zola and
-- Here Comes the Guide did not. connection_type stays manual_label for the
-- New Lead picker; email intake still uses trust_tier email_parsed and may
-- write these keys onto leads.source only when attribution is trustworthy.

insert into public.lead_sources (key, display_name, category, connection_type, is_external)
values
  ('zola', 'Zola', 'marketplace', 'manual_label', true),
  ('here_comes_the_guide', 'Here Comes the Guide', 'marketplace', 'manual_label', true)
on conflict (key) do nothing;
