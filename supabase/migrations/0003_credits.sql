-- User credits (one row per user)
create table user_credits (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  credits    integer not null default 0,
  updated_at timestamptz default now(),
  constraint credits_non_negative check (credits >= 0)
);

alter table user_credits enable row level security;

create policy "Users read own credits"
  on user_credits for select
  using (auth.uid() = user_id);

-- New users start with 2 free credits
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_credits (user_id, credits)
  values (new.id, 1);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Atomic decrement: returns remaining credits, or -1 if exhausted
create or replace function decrement_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  update user_credits
  set credits = credits - 1, updated_at = now()
  where user_id = p_user_id and credits > 0
  returning credits into v_remaining;
  return coalesce(v_remaining, -1);
end;
$$;

-- Atomic add (used by Stripe webhook)
create or replace function add_credits(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_credits (user_id, credits, updated_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id)
  do update set
    credits    = user_credits.credits + p_amount,
    updated_at = now();
end;
$$;
