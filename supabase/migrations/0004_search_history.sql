create table search_history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  city          text not null,
  business_type text,
  mode          text not null,
  created_at    timestamptz default now()
);

alter table search_history enable row level security;

create policy "Users read own history"
  on search_history for select
  using (auth.uid() = user_id);

create policy "Users insert own history"
  on search_history for insert
  with check (auth.uid() = user_id);

create index idx_search_history_user
  on search_history (user_id, created_at desc);
