-- Record the disclosed 7.5% service fee separately from the base membership.
alter table public.service_agreements
  add column if not exists base_amount numeric(10,2),
  add column if not exists service_fee_rate numeric(7,4),
  add column if not exists service_fee_amount numeric(10,2);

alter table public.service_agreements
  drop constraint if exists service_agreements_service_fee_rate_check;
alter table public.service_agreements
  add constraint service_agreements_service_fee_rate_check
  check (service_fee_rate is null or (service_fee_rate >= 0 and service_fee_rate <= 100));

comment on column public.service_agreements.monthly_amount is
  'Total recurring charge: base amount plus disclosed service fee, before applicable taxes.';
