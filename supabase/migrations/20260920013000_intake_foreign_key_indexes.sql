-- Cover intake audit foreign keys used by staff review and member history views.
create index if not exists intake_requests_submitted_by_idx
  on public.intake_requests (submitted_by);

create index if not exists intake_requests_reviewed_by_idx
  on public.intake_requests (reviewed_by);
