alter table public.wines
  add column if not exists barcode text,
  add column if not exists label_source text
    check (label_source is null or label_source in ('camera_upload', 'open_food_facts', 'wikimedia_commons')),
  add column if not exists label_source_url text;

create index if not exists wines_barcode_idx on public.wines(barcode)
  where barcode is not null;
