-- Divinos: explicit release preparation state and consolidated RLS policies.

drop policy if exists release_requests_staff_all on public.release_requests;
drop policy if exists release_requests_member_read on public.release_requests;
drop policy if exists release_requests_member_insert on public.release_requests;
create policy release_requests_read on public.release_requests for select to authenticated
  using ((select private.is_staff()) or (client_id=(select private.current_client_id()) and requested_by=(select auth.uid())));
create policy release_requests_create on public.release_requests for insert to authenticated
  with check ((select private.is_staff()) or (client_id=(select private.current_client_id()) and requested_by=(select auth.uid()) and status='requested'));
create policy release_requests_staff_update on public.release_requests for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

drop policy if exists release_items_staff_all on public.release_items;
drop policy if exists release_items_member_read on public.release_items;
drop policy if exists release_items_member_insert on public.release_items;
create policy release_items_read on public.release_items for select to authenticated
  using ((select private.is_staff()) or exists (
    select 1 from public.release_requests r where r.id=release_items.request_id
      and r.client_id=(select private.current_client_id()) and r.requested_by=(select auth.uid())
  ));
create policy release_items_create on public.release_items for insert to authenticated
  with check ((select private.is_staff()) or (
    exists (select 1 from public.release_requests r where r.id=release_items.request_id and r.client_id=(select private.current_client_id()) and r.requested_by=(select auth.uid()) and r.status='requested')
    and exists (select 1 from public.bottles b where b.id=release_items.bottle_id and b.client_id=(select private.current_client_id()) and b.status='in_storage')
  ));
create policy release_items_staff_update on public.release_items for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

drop policy if exists release_events_staff_read on public.release_events;
drop policy if exists release_events_member_read on public.release_events;
drop policy if exists release_events_staff_insert on public.release_events;
drop policy if exists release_events_member_insert on public.release_events;
create policy release_events_read on public.release_events for select to authenticated
  using ((select private.is_staff()) or exists (
    select 1 from public.release_requests r where r.id=release_events.request_id
      and r.client_id=(select private.current_client_id()) and r.requested_by=(select auth.uid())
  ));
create policy release_events_create on public.release_events for insert to authenticated
  with check (
    ((select private.is_staff()) and actor_id=(select auth.uid()))
    or (actor_id=(select auth.uid()) and action='requested' and exists (
      select 1 from public.release_requests r where r.id=release_events.request_id and r.requested_by=(select auth.uid())
    ))
  );

create or replace function public.start_release_processing(p_request_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare v_request public.release_requests%rowtype;
begin
  if not private.is_staff() then raise exception 'Solo el personal puede preparar una salida.'; end if;
  select * into v_request from public.release_requests where id=p_request_id for update;
  if not found then raise exception 'Solicitud no encontrada.'; end if;
  if v_request.status<>'requested' then raise exception 'La solicitud ya no está pendiente.'; end if;
  update public.release_requests set status='processing',updated_at=now() where id=p_request_id;
  insert into public.release_events(request_id,action,actor_id,snapshot)
  values(p_request_id,'processing_started',(select auth.uid()),jsonb_build_object('receipt_code',v_request.receipt_code));
end $$;
revoke all on function public.start_release_processing(uuid) from public,anon;
grant execute on function public.start_release_processing(uuid) to authenticated;

