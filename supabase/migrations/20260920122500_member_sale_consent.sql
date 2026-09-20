alter table public.member_sale_requests
  add column if not exists seller_certified_at timestamptz not null default now(),
  add column if not exists terms_version text not null default '2026-09-20';
