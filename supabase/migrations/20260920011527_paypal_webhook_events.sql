create table if not exists public.payment_events (
  id text primary key,
  provider text not null default 'paypal' check (provider = 'paypal'),
  event_type text not null,
  resource_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received','processed','ignored','failed')),
  error_message text
);
alter table public.payment_events enable row level security;
create policy payment_events_staff_read on public.payment_events for select to authenticated
  using ((select private.is_staff()));
grant select on public.payment_events to authenticated;
