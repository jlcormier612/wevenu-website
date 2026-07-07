-- Sprint 96: Venue Feedback System
-- Venues submit support requests, bug reports, feature ideas, and NPS scores.

create type feedback_type   as enum ('support', 'bug', 'feature', 'nps', 'general');
create type feedback_status as enum ('open', 'acknowledged', 'resolved');

create table venue_feedback (
  id         uuid            primary key default gen_random_uuid(),
  venue_id   uuid            not null references venues(id) on delete cascade,
  user_id    uuid            not null references auth.users(id) on delete cascade,
  type       feedback_type   not null,
  subject    text,
  body       text            not null default '',
  rating     smallint        check (rating between 1 and 10),
  status     feedback_status not null default 'open',
  created_at timestamptz     not null default now()
);

alter table venue_feedback enable row level security;

-- Venues can insert their own feedback
create policy "venues can submit feedback"
  on venue_feedback for insert to authenticated
  with check (
    venue_id = (
      select venue_id from venue_users where user_id = auth.uid() limit 1
    )
  );

-- Venues can read their own submissions
create policy "venues can read own feedback"
  on venue_feedback for select to authenticated
  using (
    venue_id = (
      select venue_id from venue_users where user_id = auth.uid() limit 1
    )
  );

-- Index for admin list view
create index venue_feedback_created_at_idx on venue_feedback (created_at desc);
create index venue_feedback_venue_id_idx   on venue_feedback (venue_id);
