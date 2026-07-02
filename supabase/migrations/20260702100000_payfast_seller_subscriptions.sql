create extension if not exists pgcrypto;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'payfast',
  payment_type text not null default 'seller_subscription',
  user_id uuid references auth.users(id) on delete set null,
  seller_id bigint references public.sellers(id) on delete set null,
  m_payment_id text unique not null,
  provider_payment_id text,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed', 'cancelled', 'unknown')),
  plan text check (plan in ('gold', 'platinum')),
  billing_interval text check (billing_interval in ('monthly', 'yearly')),
  item_name text,
  raw_request jsonb not null default '{}'::jsonb,
  raw_notify jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists public.seller_subscriptions (
  id uuid primary key default gen_random_uuid(),
  seller_id bigint not null unique references public.sellers(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  tier text not null check (tier in ('gold', 'platinum')),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired', 'past_due')),
  provider text not null default 'payfast',
  provider_payment_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
before update on public.payments
for each row execute function public.touch_updated_at();

drop trigger if exists trg_seller_subscriptions_updated_at on public.seller_subscriptions;
create trigger trg_seller_subscriptions_updated_at
before update on public.seller_subscriptions
for each row execute function public.touch_updated_at();

create index if not exists idx_payments_user on public.payments(user_id, created_at desc);
create index if not exists idx_payments_seller on public.payments(seller_id, created_at desc);
create index if not exists idx_payments_status on public.payments(status, created_at desc);
create index if not exists idx_seller_subscriptions_user on public.seller_subscriptions(user_id);
create index if not exists idx_seller_subscriptions_status on public.seller_subscriptions(status, current_period_end);

alter table public.payments enable row level security;
alter table public.seller_subscriptions enable row level security;

revoke all on table public.payments from anon;
revoke all on table public.seller_subscriptions from anon;
grant select on table public.payments to authenticated;
grant select on table public.seller_subscriptions to authenticated;

drop policy if exists payments_select_owner_admin on public.payments;
create policy payments_select_owner_admin
on public.payments
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.sellers s
    where s.id = payments.seller_id
      and s.auth_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists seller_subscriptions_select_owner_admin on public.seller_subscriptions;
create policy seller_subscriptions_select_owner_admin
on public.seller_subscriptions
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.sellers s
    where s.id = seller_subscriptions.seller_id
      and s.auth_id = auth.uid()
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
