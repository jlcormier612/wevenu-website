-- Expand prior-product Standard fingerprint so ensure_standard_sales_pipeline
-- upgrades both known wrong seeds and never leaves the incorrect probabilities
-- (Inquiry 20 / Tour 40 / Proposal 50 / Contract 75 / Follow-Up 60 / Booked 90)
-- as a silent recreate path. Intentional Customize Pipeline edits that do not
-- match either fingerprint remain untouched.

create or replace function public._standard_pipeline_is_prior_product_seed(p_template_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.pipeline_stages where pipeline_template_id = p_template_id) = 8
    and (
      (
        exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'In Workflow' and probability = 25
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Custom Proposal' and probability = 70
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Follow-Up' and probability = 90
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Booked' and probability = 100
        )
      )
      or (
        exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'New Inquiry' and probability = 20
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Tour Scheduled' and probability = 40
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Custom Proposal' and probability = 50
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Contract Sent' and probability = 75
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Follow-Up' and probability = 60
        )
        and exists (
          select 1 from public.pipeline_stages
          where pipeline_template_id = p_template_id and name = 'Booked' and probability = 90
        )
      )
    );
$$;
