-- Hello to Cheers pipeline stages use a controlled product palette.
-- Normalize existing rows by stage order first so legacy arbitrary hex values
-- cannot survive the UI/API constraint introduced by this migration.

with ranked as (
  select
    id,
    row_number() over (partition by pipeline_template_id order by sort_order, id) - 1 as palette_index
  from public.pipeline_stages
)
update public.pipeline_stages s
set color = case (r.palette_index % 7)
  when 0 then '#5D6F5D'
  when 1 then '#4F5F4F'
  when 2 then '#B9D1C2'
  when 3 then '#B8AEA1'
  when 4 then '#DED6CA'
  when 5 then '#D8A7AA'
  else '#6F6A61'
end
from ranked r
where r.id = s.id;

alter table public.pipeline_stages
  add constraint pipeline_stages_brand_color_check
  check (color in (
    '#5D6F5D',
    '#4F5F4F',
    '#B9D1C2',
    '#B8AEA1',
    '#DED6CA',
    '#D8A7AA',
    '#6F6A61'
  ));
