-- Event Order recovery: archive legacy checklist starters, seed delivery
-- structure starters (EO-D-01 / EO-D-02), and publish coordinator Help.
--
-- Product model (locked): templates are delivery structure only — sections +
-- guidance. Checklist/process lines on EO-01 / EO-02 are not applied to live
-- Event Orders (app already skips template lines). Archiving removes them from
-- active Library / picker so venues are not offered misleading $0 checklists.
-- venues.event_order_enabled remains deprecated and is not a product gate.

-- ── 1. Archive legacy checklist masters (EO-01 / EO-02) ─────────────────────
update public.event_order_templates
set is_archived = true,
    updated_at = now()
where source_master_key in ('EO-01', 'EO-02')
  and is_archived = false;

-- ── 2. Seed delivery starters for every venue missing them ───────────────────
-- EO-D-01 Wedding Reception
insert into public.event_order_templates (venue_id, name, description, source_master_key)
select
  v.id,
  'Wedding Reception',
  'Delivery structure for a full wedding reception — fill with Offerings.',
  'EO-D-01'
from public.venues v
where not exists (
  select 1 from public.event_order_templates t
  where t.venue_id = v.id and t.source_master_key = 'EO-D-01'
)
and not exists (
  select 1 from public.event_order_templates t
  where t.venue_id = v.id and t.name = 'Wedding Reception' and t.is_archived = false
);

insert into public.event_order_template_sections (template_id, venue_id, name, guidance, sort_order)
select t.id, t.venue_id, s.name, s.guidance, s.sort_order
from public.event_order_templates t
cross join (
  values
    (0, 'Catering', 'Add plated or buffet offerings for this event.'),
    (1, 'Bar', 'Add bar packages, toasts, and signature drinks.'),
    (2, 'Rentals', 'Add rental products the couple is receiving.'),
    (3, 'Services', 'Add staffing and coordination services.'),
    (4, 'Other', 'Anything else this event is receiving.')
) as s(sort_order, name, guidance)
where t.source_master_key = 'EO-D-01'
  and not exists (
    select 1 from public.event_order_template_sections x where x.template_id = t.id
  );

-- EO-D-02 Ceremony + Reception
insert into public.event_order_templates (venue_id, name, description, source_master_key)
select
  v.id,
  'Ceremony + Reception',
  'Delivery structure covering ceremony and reception provision.',
  'EO-D-02'
from public.venues v
where not exists (
  select 1 from public.event_order_templates t
  where t.venue_id = v.id and t.source_master_key = 'EO-D-02'
)
and not exists (
  select 1 from public.event_order_templates t
  where t.venue_id = v.id and t.name = 'Ceremony + Reception' and t.is_archived = false
);

insert into public.event_order_template_sections (template_id, venue_id, name, guidance, sort_order)
select t.id, t.venue_id, s.name, s.guidance, s.sort_order
from public.event_order_templates t
cross join (
  values
    (0, 'Ceremony', 'Ceremony-related offerings and rentals.'),
    (1, 'Catering', 'Add plated or buffet offerings for this event.'),
    (2, 'Bar', 'Add bar packages, toasts, and signature drinks.'),
    (3, 'Rentals', 'Add rental products the couple is receiving.'),
    (4, 'Services', 'Add staffing and coordination services.'),
    (5, 'Other', 'Anything else this event is receiving.')
) as s(sort_order, name, guidance)
where t.source_master_key = 'EO-D-02'
  and not exists (
    select 1 from public.event_order_template_sections x where x.template_id = t.id
  );

-- ── 3. Help & Guides — Event Order (Building the Event) ─────────────────────
insert into public.success_library_articles
  (slug, title, goal_category, why_it_matters, when_to_use, best_practices, common_mistakes, related_features, linked_gap_keys, status)
values
  (
    'what-is-an-event-order',
    'What is an Event Order, and when do I use one?',
    'Building the Event',
    'An Event Order is the delivery record for one booked event — what the couple is actually receiving (catering, bar, rentals, services), organized into sections.

It is optional. Package selection, invoices, and Client Planning stay the commercial and planning sources of truth. Use an Event Order when you need a clear delivery list for the team or to share with the couple.',
    'Open the event workspace → Event Order.

Start blank, or apply a Library template for section structure only. Then add Offerings (priced or included) on the live Event Order.

Share with the couple only when you are ready for them to see it. Finalizing locks the working record; share creates the couple-visible snapshot.',
    'How to build and share an Event Order

1. Open the client''s event and select Event Order.
2. Start blank, or choose a delivery template (structure only — not a priced commitment).
3. Add Offerings into the right sections. Included items can be $0; priced items carry the delivery price.
4. Use Finalize when the delivery record is locked for your team.
5. Use Share when the couple should see it in their portal (Event Order appears in portal navigation after share).

Templates live in Library → Event Order Templates. Editing a template never changes Event Orders already started on events.',
    'Common mistakes

- Treating a template as a finished, priced document. Templates only copy section structure. Add real Offerings on the event.
- Sharing before prices and inclusions are ready. Couples see what you share — including a $0 total if you have not added priced lines yet. Hello to Cheers warns you before finalize/share when the total is $0 with lines present.
- Expecting Event Order to replace invoices or contracts. Payments and signing stay on Invoices and Contracts.

Navigation: Event workspace → Event Order · Library → Event Order Templates',
    '[{"label":"Library — Event Order Templates","href":"/library/event-order-templates"},{"label":"Open Clients","href":"/clients"}]'::jsonb,
    array[]::text[],
    'published'
  )
on conflict (slug) do update set
  title = excluded.title,
  goal_category = excluded.goal_category,
  why_it_matters = excluded.why_it_matters,
  when_to_use = excluded.when_to_use,
  best_practices = excluded.best_practices,
  common_mistakes = excluded.common_mistakes,
  related_features = excluded.related_features,
  linked_gap_keys = excluded.linked_gap_keys,
  status = excluded.status,
  updated_at = now();
