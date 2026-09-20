-- Public visitors may browse released products and reviews. Orders, clients,
-- inventory, memberships and storage remain unavailable to the anon role.
grant select on public.wine_sale_offers, public.wines, public.wine_reviews to anon;

drop policy if exists wine_sale_offers_public_read on public.wine_sale_offers;
create policy wine_sale_offers_public_read
on public.wine_sale_offers for select to anon
using (
  active = true
  and public_release_at is not null
  and public_release_at <= now()
);

drop policy if exists wines_public_store_read on public.wines;
create policy wines_public_store_read
on public.wines for select to anon
using (
  exists (
    select 1 from public.wine_sale_offers o
    where o.wine_id = wines.id
      and o.active = true
      and o.public_release_at is not null
      and o.public_release_at <= now()
  )
);

drop policy if exists wine_reviews_public_read on public.wine_reviews;
create policy wine_reviews_public_read
on public.wine_reviews for select to anon
using (
  exists (
    select 1 from public.wine_sale_offers o
    where o.wine_id = wine_reviews.wine_id
      and o.active = true
      and o.public_release_at is not null
      and o.public_release_at <= now()
  )
);
