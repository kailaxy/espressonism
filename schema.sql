-- Supabase/PostgreSQL schema for Espressonism real-time ordering

create extension if not exists "pgcrypto";

-- Menu categories table - single source of truth for all category data
create table if not exists public.menu_categories (
  key text primary key,
  label text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  icon_svg text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_categories
  add column if not exists icon_svg text;

-- Seed initial categories
insert into public.menu_categories (key, label, sort_order, active)
values
  ('espresso', 'Espresso', 1, true),
  ('signature', 'Signature', 2, true),
  ('bites', 'Bites', 3, true),
  ('highlights', 'Highlights', 4, true)
on conflict (key) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  active = excluded.active;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  base_price numeric(10, 2) not null check (base_price >= 0),
  price_solo numeric(10, 2) not null default 0 check (price_solo >= 0),
  price_doppio numeric(10, 2) not null default 0 check (price_doppio >= 0),
  image_url text,
  category text not null default 'signature' references public.menu_categories(key) on delete restrict
);

alter table public.menu_items
  add column if not exists category text not null default 'signature' references public.menu_categories(key) on delete restrict,
  add column if not exists price_solo numeric(10, 2),
  add column if not exists price_doppio numeric(10, 2);

update public.menu_items
set
  price_solo = coalesce(price_solo, base_price),
  price_doppio = coalesce(price_doppio, base_price)
where price_solo is null
   or price_doppio is null;

alter table public.menu_items
  alter column price_solo set default 0,
  alter column price_doppio set default 0,
  alter column price_solo set not null,
  alter column price_doppio set not null;

-- Remove old hardcoded check constraint if it exists
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'menu_items_category_check'
      and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      drop constraint menu_items_category_check;
  end if;
end $$;

insert into public.menu_items (name, description, base_price, price_solo, price_doppio, image_url, category)
values
  ('Double Espresso', 'Two bold shots with dark cocoa notes.', 90.00, 90.00, 115.00, 'https://images.unsplash.com/photo-1510707577719-ae7c14805e2e', 'espresso'),
  ('Americano Black', 'Extended espresso with hot water and extra aroma.', 100.00, 100.00, 125.00, 'https://images.unsplash.com/photo-1494314671902-399b18174975', 'espresso'),
  ('Piccolo Latte', 'Compact milk coffee with rich body.', 120.00, 120.00, 145.00, 'https://images.unsplash.com/photo-1529447197861-3f296e5d7f84', 'espresso'),
  ('Spanish Latte', 'Silky espresso with condensed milk sweetness.', 145.00, 145.00, 170.00, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93', 'signature'),
  ('Sea Salt Mocha', 'Chocolate espresso with sea-salt cream top.', 160.00, 160.00, 185.00, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085', 'signature'),
  ('Orange Cold Brew', 'Citrus bright cold brew over crystal ice.', 165.00, 165.00, 190.00, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735', 'signature')
on conflict (name) do update
set
  description = excluded.description,
  base_price = excluded.base_price,
  price_solo = excluded.price_solo,
  price_doppio = excluded.price_doppio,
  image_url = excluded.image_url,
  category = excluded.category;

update public.menu_items
set category = 'espresso'
where category = 'signature'
  and lower(name) in ('double espresso', 'americano black', 'piccolo latte', 'espresso');

update public.menu_items
set category = 'bites'
where category = 'signature'
  and (
    lower(name) like '%croissant%'
    or lower(name) like '%melt%'
    or lower(name) like '%tart%'
    or lower(name) like '%cookie%'
    or lower(name) like '%sandwich%'
    or lower(name) like '%ham%'
    or lower(name) like '%choco%'
  );

create table if not exists public.daily_feature (
  id integer primary key check (id = 1),
  title text not null default '',
  description text not null default '',
  dose text not null default '',
  extraction_time text not null default '',
  brew_temp text not null default '',
  guest_score text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.today_at_bar (
  id integer primary key check (id = 1),
  title text not null default '',
  description text not null default '',
  dose text not null default '',
  extraction_time text not null default '',
  brew_temp text not null default '',
  guest_score text not null default '',
  carousel_enabled boolean not null default false,
  carousel_autoplay boolean not null default true,
  carousel_interval_ms integer not null default 5500,
  carousel_slides jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.today_at_bar
  add column if not exists carousel_enabled boolean not null default false,
  add column if not exists carousel_autoplay boolean not null default true,
  add column if not exists carousel_interval_ms integer not null default 5500,
  add column if not exists carousel_slides jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'today_at_bar_carousel_interval_ms_check'
      and conrelid = 'public.today_at_bar'::regclass
  ) then
    alter table public.today_at_bar
      add constraint today_at_bar_carousel_interval_ms_check
      check (carousel_interval_ms between 2200 and 15000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'today_at_bar_carousel_slides_array_check'
      and conrelid = 'public.today_at_bar'::regclass
  ) then
    alter table public.today_at_bar
      add constraint today_at_bar_carousel_slides_array_check
      check (jsonb_typeof(carousel_slides) = 'array');
  end if;
end $$;

create table if not exists public.today_highlights (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (menu_item_id)
);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  unit text not null check (length(trim(unit)) > 0),
  cost_per_unit numeric(10, 2) not null check (cost_per_unit >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  quantity numeric(10, 3) not null check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (menu_item_id, ingredient_id)
);

create table if not exists public.menu_customization_options (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  option_type text not null default 'other' check (option_type in ('milk', 'syrup', 'topping', 'other')),
  extra_cost numeric(10, 2) not null default 0 check (extra_cost >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, option_type)
);

create table if not exists public.menu_item_customizations (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  option_id uuid not null references public.menu_customization_options(id) on delete cascade,
  sort_order integer not null default 0,
  required boolean not null default false,
  max_select integer not null default 1 check (max_select >= 1),
  created_at timestamptz not null default now(),
  unique (menu_item_id, option_id)
);

insert into public.menu_customization_options (name, option_type, extra_cost, active)
values
  ('Whole Milk', 'milk', 0, true),
  ('Oat Milk', 'milk', 50, true),
  ('Almond Milk', 'milk', 50, true),
  ('Vanilla Syrup', 'syrup', 20, true),
  ('Caramel Syrup', 'syrup', 20, true)
on conflict (name, option_type) do update
set
  extra_cost = excluded.extra_cost,
  active = excluded.active,
  updated_at = now();

insert into public.menu_item_customizations (menu_item_id, option_id, sort_order, required, max_select)
select
  menu_item.id,
  option.id,
  case option.option_type
    when 'milk' then 10
    when 'syrup' then 20
    else 30
  end as sort_order,
  option.option_type = 'milk' as required,
  case option.option_type
    when 'milk' then 1
    when 'syrup' then 2
    else 1
  end as max_select
from public.menu_items menu_item
join public.menu_customization_options option
  on option.active = true
where menu_item.category in ('espresso', 'signature')
on conflict (menu_item_id, option_id) do nothing;

create or replace function public.touch_menu_customization_option_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_menu_customization_option_updated_at on public.menu_customization_options;
create trigger trg_touch_menu_customization_option_updated_at
before update on public.menu_customization_options
for each row
execute function public.touch_menu_customization_option_updated_at();

insert into public.daily_feature (id, title, description, dose, extraction_time, brew_temp, guest_score)
values (1, 'Daily Signature', 'Owner notes for today.', '18g', '27s', '92C', '4.8/5')
on conflict (id) do nothing;

insert into public.today_at_bar (id, title, description, dose, extraction_time, brew_temp, guest_score)
values (
  1,
  'Today at the Bar',
  'Single-origin Ethiopia on slow pour, plus our house espresso blend with cacao and citrus finish.',
  '18g',
  '27s',
  '92C',
  '4.9/5'
)
on conflict (id) do nothing;

insert into public.today_highlights (menu_item_id)
select id
from public.menu_items
where lower(name) in ('spanish latte', 'sea salt mocha', 'orange cold brew', 'butter croissant')
on conflict (menu_item_id) do nothing;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
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
  pickup_time text,
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists user_id uuid,
  add column if not exists customer_phone text,
  add column if not exists order_type text not null default 'pickup',
  add column if not exists payment_method text not null default 'cash',
  add column if not exists gcash_reference text,
  add column if not exists delivery_address text,
  add column if not exists pickup_time text;

alter table public.orders
  alter column user_id drop not null,
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
  add column if not exists user_id uuid;

alter table public.orders_archive
  add column if not exists pickup_time text;

alter table public.orders_archive
  add column if not exists archived_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders_archive'
      and column_name = 'user_id'
  ) then
    alter table public.orders_archive
      alter column user_id drop not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders_archive'
      and column_name = 'id'
  ) then
    alter table public.orders_archive
      alter column id drop default;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders_archive'
      and column_name = 'created_at'
  ) then
    alter table public.orders_archive
      alter column created_at set default now();
  end if;
end $$;

create table if not exists public.loyalty_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone_number text,
  current_stamps integer not null default 0,
  total_stamps_earned integer not null default 0
);

alter table public.loyalty_profiles
  add column if not exists full_name text,
  add column if not exists phone_number text,
  add column if not exists current_stamps integer not null default 0,
  add column if not exists total_stamps_earned integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_user_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_archive_user_id_fkey'
      and conrelid = 'public.orders_archive'::regclass
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders_archive'
      and column_name = 'user_id'
  ) then
    alter table public.orders_archive
      add constraint orders_archive_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;

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

create or replace function public.touch_daily_feature_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_daily_feature_updated_at on public.daily_feature;
create trigger trg_touch_daily_feature_updated_at
before update on public.daily_feature
for each row
execute function public.touch_daily_feature_updated_at();

create or replace function public.touch_today_at_bar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_today_at_bar_updated_at on public.today_at_bar;
create trigger trg_touch_today_at_bar_updated_at
before update on public.today_at_bar
for each row
execute function public.touch_today_at_bar_updated_at();

create or replace function public.archive_pickup_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.orders_archive (
    id,
    user_id,
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
    pickup_time,
    created_at
  )
  values (
    new.id,
    new.user_id,
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
    new.pickup_time,
    new.created_at
  )
  on conflict (id) do update
  set
    user_id = excluded.user_id,
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
    pickup_time = excluded.pickup_time,
    created_at = excluded.created_at,
    archived_at = now();

  delete from public.orders where id = new.id;
  return null;
end;
$$;

create or replace function public.sync_loyalty_profile_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;

  insert into public.loyalty_profiles (
    user_id,
    full_name,
    phone_number,
    current_stamps,
    total_stamps_earned
  )
  values (
    new.user_id,
    nullif(trim(new.customer_name), ''),
    nullif(trim(coalesce(new.customer_phone, '')), ''),
    1,
    1
  )
  on conflict (user_id) do update
  set
    full_name = excluded.full_name,
    phone_number = excluded.phone_number,
    current_stamps = public.loyalty_profiles.current_stamps + 1,
    total_stamps_earned = public.loyalty_profiles.total_stamps_earned + 1;

  return new;
end;
$$;

drop trigger if exists trg_archive_pickup_orders on public.orders;
create trigger trg_archive_pickup_orders
after insert or update of status, order_type on public.orders
for each row
when (new.order_type = 'pickup' and new.status in ('completed', 'cancelled'))
execute function public.archive_pickup_orders();

drop trigger if exists trg_sync_loyalty_on_completed_delivery_order on public.orders;
create trigger trg_sync_loyalty_on_completed_delivery_order
after update of status, order_type, user_id on public.orders
for each row
when (
  old.status is distinct from 'completed'
  and new.status = 'completed'
  and new.order_type = 'delivery'
  and new.user_id is not null
)
execute function public.sync_loyalty_profile_from_order();

drop trigger if exists trg_sync_loyalty_on_archived_order_insert on public.orders_archive;
create trigger trg_sync_loyalty_on_archived_order_insert
after insert on public.orders_archive
for each row
when (
  new.status = 'completed'
  and new.user_id is not null
)
execute function public.sync_loyalty_profile_from_order();

insert into public.orders_archive (
  id,
  user_id,
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
  pickup_time,
  created_at
)
select
  id,
  user_id,
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
  pickup_time,
  created_at
from public.orders
where order_type = 'pickup'
  and status in ('completed', 'cancelled')
on conflict (id) do update
set
  user_id = excluded.user_id,
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
  pickup_time = excluded.pickup_time,
  created_at = excluded.created_at,
  archived_at = now();

delete from public.orders
where order_type = 'pickup'
  and status in ('completed', 'cancelled');

alter table public.menu_items enable row level security;
alter table public.daily_feature enable row level security;
alter table public.today_at_bar enable row level security;
alter table public.today_highlights enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.menu_customization_options enable row level security;
alter table public.menu_item_customizations enable row level security;
alter table public.orders enable row level security;
alter table public.orders_archive enable row level security;
alter table public.loyalty_profiles enable row level security;

drop policy if exists "Menu is readable by everyone" on public.menu_items;
create policy "Menu is readable by everyone"
on public.menu_items
for select
to anon, authenticated
using (true);

drop policy if exists "Dashboard can insert menu items" on public.menu_items;
create policy "Dashboard can insert menu items"
on public.menu_items
for insert
to anon, authenticated
with check (true);

drop policy if exists "Dashboard can delete menu items" on public.menu_items;
create policy "Dashboard can delete menu items"
on public.menu_items
for delete
to anon, authenticated
using (true);

drop policy if exists "Dashboard can update menu images" on public.menu_items;
create policy "Dashboard can update menu images"
on public.menu_items
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Today highlights are readable by everyone" on public.today_highlights;
create policy "Today highlights are readable by everyone"
on public.today_highlights
for select
to anon, authenticated
using (true);

drop policy if exists "Dashboard can insert today highlights" on public.today_highlights;
create policy "Dashboard can insert today highlights"
on public.today_highlights
for insert
to anon, authenticated
with check (true);

drop policy if exists "Dashboard can delete today highlights" on public.today_highlights;
create policy "Dashboard can delete today highlights"
on public.today_highlights
for delete
to anon, authenticated
using (true);

drop policy if exists "Ingredients are readable by everyone" on public.ingredients;
create policy "Ingredients are readable by everyone"
on public.ingredients
for select
to anon, authenticated
using (true);

drop policy if exists "Dashboard can insert ingredients" on public.ingredients;
create policy "Dashboard can insert ingredients"
on public.ingredients
for insert
to anon, authenticated
with check (true);

drop policy if exists "Dashboard can update ingredients" on public.ingredients;
create policy "Dashboard can update ingredients"
on public.ingredients
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Dashboard can delete ingredients" on public.ingredients;
create policy "Dashboard can delete ingredients"
on public.ingredients
for delete
to anon, authenticated
using (true);

drop policy if exists "Recipe ingredients are readable by everyone" on public.recipe_ingredients;
create policy "Recipe ingredients are readable by everyone"
on public.recipe_ingredients
for select
to anon, authenticated
using (true);

drop policy if exists "Dashboard can insert recipe ingredients" on public.recipe_ingredients;
create policy "Dashboard can insert recipe ingredients"
on public.recipe_ingredients
for insert
to anon, authenticated
with check (true);

drop policy if exists "Dashboard can update recipe ingredients" on public.recipe_ingredients;
create policy "Dashboard can update recipe ingredients"
on public.recipe_ingredients
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Dashboard can delete recipe ingredients" on public.recipe_ingredients;
create policy "Dashboard can delete recipe ingredients"
on public.recipe_ingredients
for delete
to anon, authenticated
using (true);

drop policy if exists "Customization options are readable by everyone" on public.menu_customization_options;
create policy "Customization options are readable by everyone"
on public.menu_customization_options
for select
to anon, authenticated
using (true);

drop policy if exists "Dashboard can insert customization options" on public.menu_customization_options;
create policy "Dashboard can insert customization options"
on public.menu_customization_options
for insert
to anon, authenticated
with check (true);

drop policy if exists "Dashboard can update customization options" on public.menu_customization_options;
create policy "Dashboard can update customization options"
on public.menu_customization_options
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Dashboard can delete customization options" on public.menu_customization_options;
create policy "Dashboard can delete customization options"
on public.menu_customization_options
for delete
to anon, authenticated
using (true);

drop policy if exists "Menu customization links are readable by everyone" on public.menu_item_customizations;
create policy "Menu customization links are readable by everyone"
on public.menu_item_customizations
for select
to anon, authenticated
using (true);

drop policy if exists "Dashboard can insert menu customization links" on public.menu_item_customizations;
create policy "Dashboard can insert menu customization links"
on public.menu_item_customizations
for insert
to anon, authenticated
with check (true);

drop policy if exists "Dashboard can update menu customization links" on public.menu_item_customizations;
create policy "Dashboard can update menu customization links"
on public.menu_item_customizations
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Dashboard can delete menu customization links" on public.menu_item_customizations;
create policy "Dashboard can delete menu customization links"
on public.menu_item_customizations
for delete
to anon, authenticated
using (true);

drop policy if exists "Daily feature is readable by everyone" on public.daily_feature;
create policy "Daily feature is readable by everyone"
on public.daily_feature
for select
to anon, authenticated
using (true);

drop policy if exists "Dashboard can update daily feature" on public.daily_feature;
create policy "Dashboard can update daily feature"
on public.daily_feature
for update
to anon, authenticated
using (id = 1)
with check (id = 1);

drop policy if exists "Today at the bar is readable by everyone" on public.today_at_bar;
create policy "Today at the bar is readable by everyone"
on public.today_at_bar
for select
to anon, authenticated
using (true);

drop policy if exists "Dashboard can update today at the bar" on public.today_at_bar;
create policy "Dashboard can update today at the bar"
on public.today_at_bar
for update
to anon, authenticated
using (id = 1)
with check (id = 1);

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
drop policy if exists "Dashboard can read archived orders" on public.orders_archive;
create policy "Dashboard can read archived orders"
on public.orders_archive
for select
to anon, authenticated
using (true);

drop policy if exists "Users can read their loyalty profile" on public.loyalty_profiles;
create policy "Users can read their loyalty profile"
on public.loyalty_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their loyalty profile" on public.loyalty_profiles;
create policy "Users can insert their loyalty profile"
on public.loyalty_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their loyalty profile" on public.loyalty_profiles;
create policy "Users can update their loyalty profile"
on public.loyalty_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on table public.menu_items to anon, authenticated;
grant insert, delete on table public.menu_items to anon, authenticated;
grant update on table public.menu_items to anon, authenticated;
grant select, update on table public.daily_feature to anon, authenticated;
grant select, update on table public.today_at_bar to anon, authenticated;
grant select, insert, delete on table public.today_highlights to anon, authenticated;
grant select, insert, update, delete on table public.ingredients to anon, authenticated;
grant select, insert, update, delete on table public.recipe_ingredients to anon, authenticated;
grant select, insert, update, delete on table public.menu_customization_options to anon, authenticated;
grant select, insert, update, delete on table public.menu_item_customizations to anon, authenticated;
grant insert on table public.orders to anon, authenticated;
grant select on table public.orders to anon, authenticated;
grant update(status) on table public.orders to anon, authenticated;
grant select on table public.orders_archive to anon, authenticated;
grant select, insert, update on table public.loyalty_profiles to authenticated;
