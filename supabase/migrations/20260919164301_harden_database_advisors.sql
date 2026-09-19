-- Keep trigger functions deterministic and immune to caller search_path changes.
alter function public.generate_slots() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.release_slot_on_exit() set search_path = public;

-- RLS helpers need SECURITY DEFINER to inspect profiles without recursion, but
-- they should not be exposed as PostgREST RPC endpoints in the public schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_staff() set schema private;
alter function public.is_admin() set schema private;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['clients','wines','racks','slots','bottles','movements'] loop
    execute format('drop policy if exists "%s_staff_all" on public.%I', t, t);
    execute format(
      'create policy "%s_staff_all" on public.%I for all to authenticated using ((select private.is_staff())) with check ((select private.is_staff()))',
      t, t
    );
  end loop;
end $$;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated
  using ((select private.is_staff()));

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Cover audit-log foreign keys used by joins and cascading checks.
create index if not exists movements_bottle_idx on public.movements(bottle_id);
create index if not exists movements_from_slot_idx on public.movements(from_slot);
create index if not exists movements_to_slot_idx on public.movements(to_slot);
create index if not exists movements_moved_by_idx on public.movements(moved_by);
