-- Cover release audit foreign keys used by staff/history queries.
create index if not exists release_requests_requested_by_idx on public.release_requests(requested_by);
create index if not exists release_requests_released_by_idx on public.release_requests(released_by) where released_by is not null;
create index if not exists release_events_actor_idx on public.release_events(actor_id);
