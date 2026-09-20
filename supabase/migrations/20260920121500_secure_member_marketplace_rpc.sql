-- Make member-facing marketplace RPCs obey RLS as the caller.
drop policy if exists member_sale_requests_write on public.member_sale_requests;
create policy member_sale_requests_write on public.member_sale_requests for insert to authenticated
  with check (
    user_id=(select auth.uid()) and
    client_id=(select private.current_client_id()) and
    (select private.is_active_member()) and
    status='pending'
  );

drop policy if exists member_sale_requests_update on public.member_sale_requests;
create policy member_sale_requests_update on public.member_sale_requests for update to authenticated
  using (
    (select private.is_staff()) or
    (user_id=(select auth.uid()) and client_id=(select private.current_client_id()) and status='pending')
  )
  with check (
    (select private.is_staff()) or
    (user_id=(select auth.uid()) and client_id=(select private.current_client_id()) and status in ('pending','cancelled'))
  );

grant insert,update on public.member_sale_requests to authenticated;
alter function public.submit_member_sale_request(uuid,numeric,text) security invoker;
alter function public.cancel_member_sale_request(uuid) security invoker;
alter function public.review_member_sale_request(uuid,text,numeric,text,text) security invoker;

create index if not exists member_sale_requests_client_idx on public.member_sale_requests(client_id);
create index if not exists member_sale_requests_reviewer_idx on public.member_sale_requests(reviewed_by);
create index if not exists wine_sale_offers_wine_idx on public.wine_sale_offers(wine_id);
create index if not exists wine_sale_offers_seller_user_idx on public.wine_sale_offers(seller_user_id) where seller_user_id is not null;
create index if not exists wine_sale_offers_seller_client_idx on public.wine_sale_offers(seller_client_id) where seller_client_id is not null;
create index if not exists wine_orders_client_idx on public.wine_orders(client_id);
create index if not exists wine_orders_seller_user_idx on public.wine_orders(seller_user_id) where seller_user_id is not null;
create index if not exists wine_orders_seller_client_idx on public.wine_orders(seller_client_id) where seller_client_id is not null;
