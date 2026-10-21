-- Galleria gestibile dal cliente: schema, RLS, Storage.
-- Lettura pubblica, scrittura solo per l'amministratore elencato in public.admins.

-- L'unico utente autorizzato (inserito a mano dal pannello Supabase, vedi README)
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;   -- nessuna policy: invisibile dall'API
revoke all on public.admins from anon, authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admins where user_id = (select auth.uid())) $$;
revoke execute on function public.is_admin() from public, anon;
grant  execute on function public.is_admin() to authenticated;

create table public.gallery_photos (
  id           uuid primary key default gen_random_uuid(),
  position     integer not null,
  storage_path text unique check (storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  ext          text check (ext in ('webp', 'jpg')),
  legacy_key   text unique check (legacy_key ~ '^gal-[0-9]{1,3}$'),
  width        integer check (width  between 1 and 8000),
  height       integer check (height between 1 and 8000),
  caption      text check (char_length(caption) <= 140),
  category     text check (category in ('prati', 'montagna', 'preparazione', 'recinzioni', 'corten', 'commerciale')),
  created_at   timestamptz not null default now(),
  check ((storage_path is null) <> (legacy_key is null)),
  check (storage_path is null or (ext is not null and width is not null and height is not null))
);
create index gallery_photos_position_idx on public.gallery_photos (position);

alter table public.gallery_photos enable row level security;
revoke all on public.gallery_photos from anon, authenticated;
grant select on public.gallery_photos to anon, authenticated;
grant insert, update, delete on public.gallery_photos to authenticated;

create policy "lettura pubblica" on public.gallery_photos
  for select to anon, authenticated using (true);
create policy "inserisce solo admin" on public.gallery_photos
  for insert to authenticated with check ((select public.is_admin()));
create policy "modifica solo admin" on public.gallery_photos
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "elimina solo admin" on public.gallery_photos
  for delete to authenticated using ((select public.is_admin()));

-- Riordino in un colpo solo, con i permessi di chi chiama (quindi sotto RLS)
create function public.reorder_gallery(p_ids uuid[]) returns void
language sql security invoker set search_path = ''
as $$ update public.gallery_photos g set position = o.ord
      from unnest(p_ids) with ordinality as o(id, ord) where g.id = o.id $$;
revoke execute on function public.reorder_gallery(uuid[]) from public, anon;
grant  execute on function public.reorder_gallery(uuid[]) to authenticated;

-- Storage: lettura via URL pubblico, nessun elenco, scrittura solo admin, limiti imposti dal server
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 3145728, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 3145728,
  allowed_mime_types = array['image/webp', 'image/jpeg'];

create policy "gallery: select admin" on storage.objects for select to authenticated
  using (bucket_id = 'gallery' and (select public.is_admin()));
create policy "gallery: insert admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and (select public.is_admin()));
create policy "gallery: update admin" on storage.objects for update to authenticated
  using (bucket_id = 'gallery' and (select public.is_admin()))
  with check (bucket_id = 'gallery' and (select public.is_admin()));
create policy "gallery: delete admin" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and (select public.is_admin()));
