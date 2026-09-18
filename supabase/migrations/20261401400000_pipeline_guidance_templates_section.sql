-- Append Pipeline Templates customization guidance to the existing
-- "How Does My Pipeline Work?" article. Keeps the original Pipeline
-- explanation intact; adds the Templates section immediately after it.

update public.success_library_articles
   set why_it_matters = $body$Your Pipeline shows where each Lead is in your sales process.

Go to:

**Your Relationships → Leads → Pipeline**

Each Lead appears in the stage that represents where they are in the process.

Move a Lead from one stage to another as the relationship progresses.

Your Pipeline is about the **sales process** — where the relationship stands.

It isn't a task list.

If you need to remember to call someone, send a proposal, or follow up, that work belongs in **Task Center**.

If you're waiting for someone to respond or complete something, that's what **Requests** are for.

Your Pipeline answers one simple question:

**Where is this relationship in the sales process?**

### Customize your sales process

Every venue can have a sales process that works a little differently.

You can customize your Pipeline by creating and using Pipeline Templates.

Go to:

Your Relationships → Leads → Pipeline Templates

From Pipeline Templates, you can create a pipeline that matches the way your venue sells.

You can:
- create your own stages
- name the stages to match your process
- arrange the stages in the order your team uses them
- choose the reporting category that each stage belongs to

Once you activate a template, that pipeline becomes the sales process your team uses for Leads.

Your Pipeline Templates are about shaping the sales process to fit your venue. Your Leads then move through those stages as each relationship progresses.$body$,
       updated_at = now()
 where slug = 'how-does-my-pipeline-work';
