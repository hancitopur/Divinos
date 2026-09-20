-- Allow operational review while preserving webhook retry visibility.
alter table public.payment_events
  drop constraint if exists payment_events_status_check;

alter table public.payment_events
  add constraint payment_events_status_check
  check (status in ('received','processed','ignored','failed','manual_review'));

create index if not exists payment_events_status_received_idx
  on public.payment_events(status, received_at desc);

-- There is exactly one owner account. Staff roles can never create another
-- superadmin accidentally or through a compromised client request.
create unique index if not exists profiles_single_superadmin_idx
  on public.profiles(role)
  where role = 'superadmin';

-- Membership activation and legal evidence are payment-controlled records.
-- Edge Functions use service_role and bypass RLS; browser clients only read.
drop policy if exists memberships_staff_all on public.memberships;
drop policy if exists memberships_staff_read on public.memberships;
create policy memberships_staff_read on public.memberships for select to authenticated
  using ((select private.is_staff()));

drop policy if exists service_agreements_staff_all on public.service_agreements;
drop policy if exists service_agreements_staff_read on public.service_agreements;
create policy service_agreements_staff_read on public.service_agreements for select to authenticated
  using ((select private.is_staff()));
