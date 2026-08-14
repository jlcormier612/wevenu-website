-- Help & Guides — Event Day / After the Event / Reports (8 approved articles).
-- Uses existing success_library_articles pipeline (goal_category taxonomy).
-- Does not modify the previously published 24-article set or Help taxonomy.

insert into public.success_library_articles
  (slug, title, goal_category, why_it_matters, when_to_use, best_practices, common_mistakes, related_features, linked_gap_keys, status)
values
  (
    'event-day-sheet',
    'What is the Day Sheet, and how do I get one?',
    'Event Day',
    'How do I get a one-page summary I can hand my team on event day?

The Day-of Sheet gives you a print-ready summary of the most important information your team may need on the day of an event.',
    'When should I use it?

The Day-of Sheet is especially useful when you want a simple document your team can print, save, or have available while working an event.',
    'How to get the Day-of Sheet

1. Open the event you want to prepare for.
2. In the event header, click Day-of Sheet.
3. A preview of the Day-of Sheet will open.
4. Review the information.
5. At the top of the preview, click Print / Save as PDF.

The Day-of Sheet includes:

- Venue name
- Event date
- Couple names
- Schedule — including times and descriptions from the event Timeline
- Vendors — including names, categories, and phone numbers
- Final Details — including ceremony and reception times, guest count, meal notes, and free-text notes',
    'Tip: Review the Day-of Sheet before the event so you can catch anything that needs to be updated while there''s still time.',
    '[{"label":"Open Events","href":"/events"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'wedding-day-dashboard',
    'What is the Wedding Day Dashboard, and when do I use it?',
    'Event Day',
    'What should I actually look at on the morning of the wedding?

The Wedding Day Dashboard is your live event-day hub. It brings together the information your team may need while an event is happening.',
    'When will I see it?

The Wedding Day Dashboard is date-specific. It appears on the actual event date — not several days beforehand.

On the morning of the event, you''ll see:

- A ✦ Today''s Dashboard button in the event header
- A banner at the top of the event page labeled Today''s Wedding Day Dashboard

The banner describes it as:

“Live timeline · Vendor check-in · Emergency contacts”

Click either one to open the Wedding Day Dashboard.',
    'What is on the dashboard?

The dashboard brings together nine areas of event information:

- Guest Summary
- Timeline
- Day-of Tasks
- Vendor Check-In
- Key Contacts
- Requests
- Floor Plans
- Seating
- Documents

Why use the Dashboard instead of searching through the event?

The Dashboard is designed for the day when you need the most important event information in one place.',
    'Important: If you are looking at an event before its actual event date, don''t worry if you don''t see Today''s Dashboard yet. It is intentionally date-gated and appears on the day of the event.',
    '[{"label":"Open Events","href":"/events"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'event-day-tasks',
    'Where do I see my event-day tasks?',
    'Event Day',
    'How do I know what''s still outstanding right before the event?

Your Task Center gives you a live view of tasks across your events, so you can see what''s overdue and what''s coming up.',
    'When should I check it?

Use the Task Center as you prepare for an event and whenever you need to see what your team still has outstanding.',
    'How to find your tasks

1. Open Tasks in the left navigation.
2. Click Task Center.

The Task Center shows your live event work, including:

- Overdue tasks
- Tasks due today
- Tasks due this week
- Blocked items

This gives you one place to check what still needs attention across your events.',
    'For event-day preparation, it can be especially useful to check for overdue or due-today items before the event begins.',
    '[{"label":"Open Task Center","href":"/tasks"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'mark-event-complete',
    'How do I mark an event complete, and what happens when I do?',
    'After the Event',
    'The wedding is over — what do I do in Hello to Cheers now?

When an event is finished, you can mark it Complete from the event itself.',
    'Why mark an event complete?

Completing an event lets you formally move the event out of its active event lifecycle and into its post-event state.',
    'How to mark an event complete

1. Open the event.
2. In the upper-right area of the event page, find the Change status control next to the event''s current status.
3. Open Change status.
4. Select Complete.

Before you mark it complete

Hello to Cheers can warn you if important event documents haven''t been finalized yet.

If the event''s Event Order and/or Floor Plan have not been finalized, you''ll see a warning before completing the event.

Take a moment to review that information before continuing.',
    'Tip: Before completing an event, make sure the information your team and client need is finalized.',
    '[{"label":"Open Events","href":"/events"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'post-event-feedback',
    'How do I collect feedback from a couple after their event?',
    'After the Event',
    'How do I ask a couple how everything went?

Hello to Cheers includes a Post-Event Feedback questionnaire specifically for gathering feedback from a couple after their event.

It works through the same questionnaire system you use for other client questionnaires.',
    'When should I send it?

Post-Event Feedback is intended for after the event, when the couple has had a chance to reflect on their experience.',
    'How it works

The questionnaire library includes a real questionnaire type called Post-Event Feedback.

Its purpose is to give the couple a chance to share how their experience felt after the event.

The default introduction says:

“Thank you for celebrating with us. When you have a moment, we''d love your Post-Event Feedback about how everything felt.”

How do I send it?

Use the same questionnaire workflow you use for your other client questionnaires:

1. Open the client''s questionnaire area.
2. Select the Post-Event Feedback questionnaire.
3. Use the existing questionnaire send workflow.
4. The couple can respond through the questionnaire experience.',
    'Important: Post-Event Feedback is a questionnaire. It is separate from any future public-review or star-rating workflow.',
    '[{"label":"Questionnaire Templates","href":"/library/questionnaire-templates"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'what-can-i-see-in-reports',
    'What can I see in Reports?',
    'Reports',
    'Where do I check how my venue is doing?

Reports gives you an overview of how your venue is doing across bookings, revenue, sales, and events.',
    'How to get to Reports

1. Open Overview in the left navigation.
2. Click Reports.

Reports has five tabs:

- Overview
- Sales
- Bookings
- Revenue
- Events

A shared date-range control lets you choose the period you''re looking at. The default is This Month.',
    'What does the Overview show?

The Overview includes metrics such as:

Bookings
Clients who signed and paid their deposit.

Leads
New inquiries during the selected period.

Booking Conversion Rate
The conversion from inquiry to booking.

Gross Booked Revenue
The total contracted value of booked events.

Payments Collected
Money actually received during the selected period.

Outstanding Balance
Booked revenue that has not yet been collected.',
    'Why use Reports?

Reports gives you a quick way to understand what''s happening in your business without having to review individual events one at a time.',
    '[{"label":"Open Reports","href":"/reporting"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'which-report-should-i-use',
    'Which report should I use for a specific question?',
    'Reports',
    'I want to know something specific — which tab do I open?

The Reports tabs answer different business questions. Here''s the easiest way to choose the right one.',
    'Overview

If you''re not sure where to start, use Overview. It brings together key measures including leads, bookings, conversion rate, booked revenue, payments collected, and outstanding balance.',
    'Sales

Use Sales when you want to understand:

- Where your opportunities are coming from
- How your opportunities are converting into bookings

Think of Sales as your lead and conversion view.

Bookings

Use Bookings when you want to understand:

- What you''ve actually booked
- What those bookings are worth

Revenue

Use Revenue when you want to understand:

- What you''ve booked
- What you''ve collected
- What is still outstanding

Revenue also includes a Who Owes Us Money breakdown.

Events

Use Events when you want to understand what your event business looks like over time.',
    'Tip: You can use the shared date-range control to make sure you''re looking at the period you actually want to understand.',
    '[{"label":"Open Reports","href":"/reporting"}]'::jsonb,
    array[]::text[],
    'published'
  ),
  (
    'save-a-report',
    'How do I save a report and find it again later?',
    'Reports',
    'I keep coming back to the same report — can I save it?

Yes. You can save a report so you can return to it later without starting over.',
    'Why save a report?

Saved Reports are useful when you regularly want to look at the same type of business information.

For example, if you regularly check your bookings or revenue, saving the report gives you a quick way back to that view.',
    'How to save a report

1. Go to Overview → Reports.
2. Open the report you want to save.
3. Set the date range you want to use.
4. Click Save Report.

Your saved report will then be available from Saved Reports.

How do I find my saved reports?

Open Saved Reports to see the reports you''ve saved.

Hello to Cheers also provides starter saved reports, including:

- Events
- Revenue
- Bookings
- Sales

Starter reports are identified with a Starter badge.

From Saved Reports, you can open a report using Open report or manage it using Manage.',
    'Saved Reports are useful when you regularly want to look at the same type of business information.',
    '[{"label":"Open Reports","href":"/reporting"},{"label":"Saved Reports","href":"/reporting/saved"}]'::jsonb,
    array[]::text[],
    'published'
  )
on conflict (slug) do nothing;
