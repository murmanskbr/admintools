alter table public.admin_requests
  add column if not exists comment_author jsonb;

alter table public.inactive_requests
  add column if not exists review_author jsonb;

alter table public.normative_submissions
  add column if not exists review_author jsonb;

alter table public.normative_marks
  add column if not exists mark_author jsonb;
