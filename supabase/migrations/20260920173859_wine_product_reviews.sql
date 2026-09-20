create table if not exists public.wine_reviews (
  id bigint generated always as identity primary key,
  wine_id uuid not null references public.wines(id) on delete cascade,
  reviewer_name text not null check (char_length(reviewer_name) between 1 and 80),
  rating smallint not null check (rating between 1 and 5),
  review_text text not null check (char_length(review_text) between 3 and 600),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.wine_reviews enable row level security;

drop policy if exists wine_reviews_authenticated_read on public.wine_reviews;
create policy wine_reviews_authenticated_read
on public.wine_reviews for select to authenticated using (true);

grant select on public.wine_reviews to authenticated;
revoke insert, update, delete on public.wine_reviews from anon, authenticated;

create index if not exists wine_reviews_wine_recent_idx
on public.wine_reviews (wine_id, created_at desc);

insert into public.wine_reviews (wine_id,reviewer_name,rating,review_text,is_demo,created_at)
select v.id,x.reviewer,x.rating,x.body,true,x.created_at
from (values
  ('Artemis Cabernet Sauvignon 2021','Carlos M.',5,'Fruta oscura, buen cuerpo y un final largo. Excelente para una cena especial.',now()-interval '3 days'),
  ('Artemis Cabernet Sauvignon 2021','María L.',4,'Elegante y balanceado. Lo dejaría respirar unos minutos antes de servir.',now()-interval '8 days'),
  ('Artemis Cabernet Sauvignon 2021','José R.',5,'Una selección segura para quien disfruta Cabernet de Napa con estructura.',now()-interval '15 days'),
  ('Tignanello 2020','Ana P.',5,'Complejo y sedoso, con mucha profundidad. Ideal para guardar en la colección.',now()-interval '2 days'),
  ('Tignanello 2020','Rafael G.',5,'Gran equilibrio entre fruta, acidez y madera. Se siente especial desde la primera copa.',now()-interval '7 days'),
  ('Tignanello 2020','Sofía C.',4,'Muy elegante. Combina bien con carnes y una cena tranquila.',now()-interval '13 days'),
  ('Gran Reserva 904 2015','Luis A.',5,'Rioja clásico, refinado y listo para disfrutar. Excelente relación entre calidad y precio.',now()-interval '1 day'),
  ('Gran Reserva 904 2015','Elena V.',5,'Aromático, suave y con un final persistente. Volvería a comprarlo.',now()-interval '6 days'),
  ('Gran Reserva 904 2015','Miguel T.',4,'Muy agradable con comida. Tradicional sin sentirse pesado.',now()-interval '12 days'),
  ('Erdener Prälat Riesling 2020','Isabel D.',5,'Fresco, aromático y preciso. Una alternativa excelente a los vinos tintos.',now()-interval '4 days'),
  ('Erdener Prälat Riesling 2020','Andrés B.',4,'Buena acidez y notas frutales. Perfecto para mariscos o comida asiática.',now()-interval '9 days'),
  ('Erdener Prälat Riesling 2020','Laura S.',5,'Ligero, elegante y muy fácil de disfrutar frío.',now()-interval '16 days')
) as x(wine_name,reviewer,rating,body,created_at)
join public.wines v on v.name=x.wine_name
where not exists (
  select 1 from public.wine_reviews r
  where r.wine_id=v.id and r.reviewer_name=x.reviewer
);
