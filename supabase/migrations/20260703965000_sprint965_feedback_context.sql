-- Sprint 96.5: Feedback Context + Feature Voting

-- 1. Metadata column on venue_feedback
alter table venue_feedback
  add column metadata jsonb not null default '{}';

-- 2. Feature votes
create table venue_feedback_votes (
  id          uuid        primary key default gen_random_uuid(),
  feedback_id uuid        not null references venue_feedback(id) on delete cascade,
  venue_id    uuid        not null references venues(id)         on delete cascade,
  created_at  timestamptz not null default now(),
  unique (feedback_id, venue_id)
);

create index venue_feedback_votes_feedback_idx on venue_feedback_votes (feedback_id);
create index venue_feedback_votes_venue_idx    on venue_feedback_votes (venue_id);

alter table venue_feedback_votes enable row level security;

create policy "venues can vote on features"
  on venue_feedback_votes for insert to authenticated
  with check (
    venue_id = (select venue_id from venue_users where user_id = auth.uid() limit 1)
  );

create policy "venues can remove own votes"
  on venue_feedback_votes for delete to authenticated
  using (
    venue_id = (select venue_id from venue_users where user_id = auth.uid() limit 1)
  );

create policy "votes are publicly visible to authenticated users"
  on venue_feedback_votes for select to authenticated
  using (true);

-- 3. RPC: public feature requests with vote counts + whether caller voted
create or replace function get_public_feature_requests()
returns table (
  id         uuid,
  subject    text,
  body       text,
  status     feedback_status,
  vote_count bigint,
  i_voted    boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    vf.id,
    vf.subject,
    vf.body,
    vf.status,
    count(vfv.id)                                                   as vote_count,
    bool_or(vfv.venue_id = (
      select venue_id from venue_users where user_id = auth.uid() limit 1
    ))                                                              as i_voted,
    vf.created_at
  from venue_feedback vf
  left join venue_feedback_votes vfv on vfv.feedback_id = vf.id
  where vf.type = 'feature'
    and vf.status != 'resolved'
  group by vf.id
  order by vote_count desc, vf.created_at desc
  limit 20;
$$;

-- 4. RPC: toggle vote (insert or delete)
create or replace function toggle_feature_vote(p_feedback_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid;
  v_voted    boolean;
begin
  select venue_id into v_venue_id
  from venue_users where user_id = auth.uid() limit 1;

  if v_venue_id is null then
    return jsonb_build_object('ok', false, 'error', 'no venue');
  end if;

  select exists(
    select 1 from venue_feedback_votes
    where feedback_id = p_feedback_id and venue_id = v_venue_id
  ) into v_voted;

  if v_voted then
    delete from venue_feedback_votes
    where feedback_id = p_feedback_id and venue_id = v_venue_id;
    return jsonb_build_object('ok', true, 'voted', false);
  else
    insert into venue_feedback_votes (feedback_id, venue_id)
    values (p_feedback_id, v_venue_id);
    return jsonb_build_object('ok', true, 'voted', true);
  end if;
end;
$$;
