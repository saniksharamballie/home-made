-- Durable buyer demand and seller-rating evidence for cross-device use.

create table if not exists public.want_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  source text not null default 'app',
  seller_id bigint references public.sellers(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint want_list_items_user_item_key unique (user_id, item)
);

create table if not exists public.rating_tokens (
  token text primary key,
  seller_id bigint not null references public.sellers(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  buyer_ref text not null default 'Anonymous',
  order_code text,
  order_code_verified boolean not null default false,
  gen_device_fingerprint text,
  expires_at timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  used_device_fingerprint text,
  created_at timestamptz not null default now()
);

create table if not exists public.seller_ratings (
  id uuid primary key default gen_random_uuid(),
  token text unique references public.rating_tokens(token) on delete set null,
  seller_id bigint not null references public.sellers(id) on delete cascade,
  buyer_id uuid references auth.users(id) on delete set null,
  buyer_ref text not null default 'Anonymous',
  order_code text,
  stars int not null check (stars between 1 and 5),
  comment text not null default '',
  trust_score int not null default 0 check (trust_score between 0 and 100),
  trust_flags text[] not null default array[]::text[],
  dwell_ms int not null default 0,
  device_fingerprint text,
  suspicious boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_want_list_items_user_created on public.want_list_items(user_id, created_at desc);
create index if not exists idx_rating_tokens_seller_created on public.rating_tokens(seller_id, created_at desc);
create index if not exists idx_seller_ratings_seller_created on public.seller_ratings(seller_id, created_at desc);
create index if not exists idx_seller_ratings_buyer_created on public.seller_ratings(buyer_id, created_at desc);

drop trigger if exists trg_want_list_items_updated_at on public.want_list_items;
create trigger trg_want_list_items_updated_at
before update on public.want_list_items
for each row execute function public.touch_updated_at();

alter table public.want_list_items enable row level security;
alter table public.rating_tokens enable row level security;
alter table public.seller_ratings enable row level security;

drop policy if exists "Want list owners can read" on public.want_list_items;
create policy "Want list owners can read" on public.want_list_items
for select using (
  auth.uid() = user_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

drop policy if exists "Want list owners can insert" on public.want_list_items;
create policy "Want list owners can insert" on public.want_list_items
for insert with check (auth.uid() = user_id);

drop policy if exists "Want list owners can update" on public.want_list_items;
create policy "Want list owners can update" on public.want_list_items
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Want list owners can delete" on public.want_list_items;
create policy "Want list owners can delete" on public.want_list_items
for delete using (auth.uid() = user_id);

drop policy if exists "Rating tokens readable by admins and sellers" on public.rating_tokens;
create policy "Rating tokens readable by admins and sellers" on public.rating_tokens
for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or exists (
    select 1 from public.sellers s
    where s.id = rating_tokens.seller_id
      and s.auth_id = auth.uid()
  )
  or created_by = auth.uid()
);

drop policy if exists "Rating tokens insertable by admins and sellers" on public.rating_tokens;
create policy "Rating tokens insertable by admins and sellers" on public.rating_tokens
for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or exists (
    select 1 from public.sellers s
    where s.id = rating_tokens.seller_id
      and s.auth_id = auth.uid()
  )
);

drop policy if exists "Rating tokens updateable by admins and sellers" on public.rating_tokens;
create policy "Rating tokens updateable by admins and sellers" on public.rating_tokens
for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or exists (
    select 1 from public.sellers s
    where s.id = rating_tokens.seller_id
      and s.auth_id = auth.uid()
  )
  or created_by = auth.uid()
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or exists (
    select 1 from public.sellers s
    where s.id = rating_tokens.seller_id
      and s.auth_id = auth.uid()
  )
  or created_by = auth.uid()
);

drop policy if exists "Seller ratings readable by related users" on public.seller_ratings;
create policy "Seller ratings readable by related users" on public.seller_ratings
for select using (
  buyer_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  or exists (
    select 1 from public.sellers s
    where s.id = seller_ratings.seller_id
      and s.auth_id = auth.uid()
  )
);

drop policy if exists "Seller ratings insertable by authenticated users" on public.seller_ratings;
create policy "Seller ratings insertable by authenticated users" on public.seller_ratings
for insert with check (auth.uid() = buyer_id);

grant select, insert, update, delete on public.want_list_items to authenticated;
grant select, insert, update on public.rating_tokens to authenticated;
grant select, insert on public.seller_ratings to authenticated;
