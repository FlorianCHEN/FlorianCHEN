create table if not exists public.dishes (
  id text primary key check (id ~ '^[a-z0-9-]{3,80}$'),
  name text not null check (char_length(name) between 1 and 60),
  category text not null,
  ingredients text[] not null default '{}',
  description text not null default '',
  image_url text,
  original_image_url text,
  image_path text,
  shot jsonb,
  is_custom boolean not null default false,
  position bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dishes enable row level security;
revoke all on table public.dishes from anon, authenticated;
create policy "No direct client access"
on public.dishes for all
to anon, authenticated
using (false)
with check (false);

create table if not exists public.kitchen_config (
  key text primary key,
  value text not null
);

alter table public.kitchen_config enable row level security;
revoke all on table public.kitchen_config from anon, authenticated;
create policy "No direct client access"
on public.kitchen_config for all
to anon, authenticated
using (false)
with check (false);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-images', 'dish-images', true, 20971520, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
