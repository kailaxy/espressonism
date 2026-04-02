-- Supabase/PostgreSQL schema for Espressonism real-time ordering

create extension if not exists "pgcrypto";

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  base_price numeric(10, 2) not null check (base_price >= 0),
  image_url text
);

insert into public.menu_items (name, description, base_price, image_url)
values
  ('Double Espresso', 'Two bold shots with dark cocoa notes.', 90.00, 'https://images.unsplash.com/photo-1510707577719-ae7c14805e2e'),
  ('Americano Black', 'Extended espresso with hot water and extra aroma.', 100.00, 'https://images.unsplash.com/photo-1494314671902-399b18174975'),
  ('Piccolo Latte', 'Compact milk coffee with rich body.', 120.00, 'https://images.unsplash.com/photo-1529447197861-3f296e5d7f84'),
  ('Spanish Latte', 'Silky espresso with condensed milk sweetness.', 145.00, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93'),
  ('Sea Salt Mocha', 'Chocolate espresso with sea-salt cream top.', 160.00, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085'),
  ('Orange Cold Brew', 'Citrus bright cold brew over crystal ice.', 165.00, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735')
on conflict (name) do update
set
  description = excluded.description,
  base_price = excluded.base_price,
  image_url = excluded.image_url;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  total_price numeric(10, 2) not null check (total_price >= 0),
  status text not null default 'received' check (status in ('received', 'brewing', 'ready', 'completed', 'cancelled')),
  order_type text not null default 'pickup',
  payment_method text not null default 'cash',
  gcash_reference text,
  delivery_address text,
  special_instructions text,
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists customer_phone text,
  add column if not exists order_type text not null default 'pickup',
  add column if not exists payment_method text not null default 'cash',
  add column if not exists gcash_reference text,
  add column if not exists delivery_address text;

alter table public.orders
  alter column created_at set default now();

create table if not exists public.orders_archive (
  like public.orders including defaults including constraints
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders_archive'::regclass
      and contype = 'p'
  ) then
    alter table public.orders_archive
      add constraint orders_archive_pkey primary key (id);
  end if;
end $$;

alter table public.orders_archive
  alter column id drop default,
  alter column created_at set default now();

alter table public.orders_archive
  add column if not exists archived_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_order_type_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_order_type_check
      check (order_type in ('pickup', 'delivery'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_method_check
      check (payment_method in ('cash', 'gcash'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_customer_phone_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_customer_phone_check
      check (customer_phone is null or length(trim(customer_phone)) >= 10);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_delivery_address_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_delivery_address_check
      check (
        (order_type = 'pickup' and delivery_address is null)
        or
        (order_type = 'delivery' and length(trim(coalesce(delivery_address, ''))) > 0)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_gcash_reference_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_gcash_reference_check
      check (
        (payment_method = 'cash' and gcash_reference is null)
        or
        (payment_method = 'gcash' and gcash_reference ~ '^[0-9]{13}$')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'created_at_gmt8'
  ) then
    alter table public.orders
      add column created_at_gmt8 timestamp generated always as (created_at at time zone 'Asia/Manila') stored;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders_archive'
      and column_name = 'created_at_gmt8'
  ) then
    alter table public.orders_archive
      add column created_at_gmt8 timestamp generated always as (created_at at time zone 'Asia/Manila') stored;
  end if;
end $$;

create or replace function public.archive_pickup_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.orders_archive (
    id,
    customer_name,
    customer_phone,
    items,
    total_price,
    status,
    order_type,
    payment_method,
    gcash_reference,
    delivery_address,
    special_instructions,
    created_at
  )
  values (
    new.id,
    new.customer_name,
    new.customer_phone,
    new.items,
    new.total_price,
    new.status,
    new.order_type,
    new.payment_method,
    new.gcash_reference,
    new.delivery_address,
    new.special_instructions,
    new.created_at
  )
  on conflict (id) do update
  set
    customer_name = excluded.customer_name,
    customer_phone = excluded.customer_phone,
    items = excluded.items,
    total_price = excluded.total_price,
    status = excluded.status,
    order_type = excluded.order_type,
    payment_method = excluded.payment_method,
    gcash_reference = excluded.gcash_reference,
    delivery_address = excluded.delivery_address,
    special_instructions = excluded.special_instructions,
    created_at = excluded.created_at,
    archived_at = now();

  delete from public.orders where id = new.id;
  return null;
end;
$$;

drop trigger if exists trg_archive_pickup_orders on public.orders;
create trigger trg_archive_pickup_orders
after insert or update of status, order_type on public.orders
for each row
when (new.order_type = 'pickup' and new.status in ('completed', 'cancelled'))
execute function public.archive_pickup_orders();

insert into public.orders_archive (
  id,
  customer_name,
  customer_phone,
  items,
  total_price,
  status,
  order_type,
  payment_method,
  gcash_reference,
  delivery_address,
  special_instructions,
  created_at
)
select
  id,
  customer_name,
  customer_phone,
  items,
  total_price,
  status,
  order_type,
  payment_method,
  gcash_reference,
  delivery_address,
  special_instructions,
  created_at
from public.orders
where order_type = 'pickup'
  and status in ('completed', 'cancelled')
on conflict (id) do update
set
  customer_name = excluded.customer_name,
  customer_phone = excluded.customer_phone,
  items = excluded.items,
  total_price = excluded.total_price,
  status = excluded.status,
  order_type = excluded.order_type,
  payment_method = excluded.payment_method,
  gcash_reference = excluded.gcash_reference,
  delivery_address = excluded.delivery_address,
  special_instructions = excluded.special_instructions,
  created_at = excluded.created_at,
  archived_at = now();

delete from public.orders
where order_type = 'pickup'
  and status in ('completed', 'cancelled');

alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.orders_archive enable row level security;

drop policy if exists "Menu is readable by everyone" on public.menu_items;
create policy "Menu is readable by everyone"
on public.menu_items
for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can insert an order" on public.orders;
create policy "Anyone can insert an order"
on public.orders
for insert
to anon, authenticated
with check (true);

drop policy if exists "Order tracking is readable by everyone" on public.orders;
drop policy if exists "Authenticated users can read orders" on public.orders;
create policy "Order tracking is readable by everyone"
on public.orders
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can update order status" on public.orders;
drop policy if exists "Dashboard can update order status" on public.orders;
create policy "Dashboard can update order status"
on public.orders
for update
to anon, authenticated
using (status in ('received', 'preparing', 'brewing', 'ready'))
with check (status in ('brewing', 'ready', 'completed', 'cancelled'));

drop policy if exists "Authenticated users can read archived orders" on public.orders_archive;
create policy "Authenticated users can read archived orders"
on public.orders_archive
for select
to authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select on table public.menu_items to anon, authenticated;
grant insert on table public.orders to anon, authenticated;
grant select on table public.orders to anon, authenticated;
grant update(status) on table public.orders to anon, authenticated;
grant select on table public.orders_archive to authenticated;
