create table analyses (
  id                uuid primary key default gen_random_uuid(),
  city              text not null,
  business_type     text,
  status            text not null default 'completed',
  businesses_count  integer not null,
  avg_rating        numeric(3,2),
  result            jsonb not null,
  cache_key         text generated always as (
    lower(city) || ':' || lower(coalesce(business_type, '_all_'))
  ) stored,
  created_at        timestamptz default now()
);

create index idx_analyses_cache_lookup on analyses (cache_key, created_at desc);
