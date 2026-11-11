-- Targeted Sandbox repair of the known-invalid Juniper Owner binding
-- created by the broken invitation path (Launch Blocker #2).
--
-- Matches only this exact corrupt row. Any other environment: UPDATE 0.
-- Uses the existing transactional last-owner bypass (htc.allow_last_owner_change)
-- so the Fancy auth user can be unbound without a second accepted Owner.

begin;

select set_config('htc.allow_last_owner_change', '1', true);

update public.venues
   set owner_user_id = '6721694e-3f38-45e6-9afa-383ba1fd7564',
       updated_at = timezone('utc', now())
 where id = 'af2d6aa1-0eb2-4e65-aa6f-c066cb71a4b6'
   and owner_user_id = '2fa73101-337b-4530-8c77-f3c272c5463e';

update public.venue_staff
   set user_id = null,
       accepted_at = null,
       invite_token = gen_random_uuid(),
       invited_at = timezone('utc', now()),
       owner_invite_pending = true,
       is_owner = false
 where id = 'f26f53a4-5613-47ff-9523-b37fad9d7adb'
   and venue_id = 'af2d6aa1-0eb2-4e65-aa6f-c066cb71a4b6'
   and lower(trim(email)) = 'jyagnesak@yahoo.com'
   and user_id = '2fa73101-337b-4530-8c77-f3c272c5463e';

select set_config('htc.allow_last_owner_change', '0', true);

commit;
