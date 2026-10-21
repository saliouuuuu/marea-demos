-- Prove delle policy: ogni asserzione fallisce con un errore, quindi psql esce con codice != 0.
\set ON_ERROR_STOP on
create temp table risultati (nome text, ok boolean);
grant all on risultati to anon, authenticated;

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b2');
insert into public.admins values ('00000000-0000-0000-0000-0000000000a1');
insert into storage.objects (bucket_id, name) values ('gallery', 'esistente.webp');  -- da elencare

create function pg_temp.tenta(nome text, istruzione text, deve_riuscire boolean) returns void
language plpgsql as $f$
declare n int; riuscito boolean;
begin
  begin
    execute istruzione;
    get diagnostics n = row_count;
    riuscito := n > 0;                 -- una scrittura bloccata da RLS tocca 0 righe, non dà errore
  exception when others then
    riuscito := false;
  end;
  insert into risultati values (nome, riuscito = deve_riuscire);
  if riuscito <> deve_riuscire then
    raise exception 'FALLITO: % (atteso %, ottenuto %)', nome, deve_riuscire, riuscito;
  end if;
end $f$;
grant execute on function pg_temp.tenta(text, text, boolean) to anon, authenticated;

\set nuova '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set foto 'insert into public.gallery_photos (position, storage_path, ext, width, height) values (0, ' :nuova ', ''webp'', 800, 600)'

-- anon
set role anon;
select pg_temp.tenta('anon legge la galleria', 'select 1 from public.gallery_photos', true);
select pg_temp.tenta('anon NON inserisce', :'foto', false);
select pg_temp.tenta('anon NON modifica', 'update public.gallery_photos set caption = ''x''', false);
select pg_temp.tenta('anon NON elimina', 'delete from public.gallery_photos', false);
select pg_temp.tenta('anon NON vede admins', 'select 1 from public.admins', false);
select pg_temp.tenta('anon NON chiama reorder', 'select public.reorder_gallery(array[]::uuid[])', false);
select pg_temp.tenta('anon NON chiama is_admin', 'select public.is_admin()', false);
select pg_temp.tenta('anon NON scrive su Storage', 'insert into storage.objects (bucket_id, name) values (''gallery'', ''x.webp'')', false);
select pg_temp.tenta('anon NON elenca Storage', 'select 1 from storage.objects', false);
reset role;

-- utente registrato ma non admin
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b2';
select pg_temp.tenta('non-admin legge la galleria', 'select 1 from public.gallery_photos', true);
select pg_temp.tenta('non-admin NON inserisce', :'foto', false);
select pg_temp.tenta('non-admin NON modifica', 'update public.gallery_photos set caption = ''x''', false);
select pg_temp.tenta('non-admin NON elimina', 'delete from public.gallery_photos', false);
select pg_temp.tenta('non-admin NON vede admins', 'select 1 from public.admins', false);
select pg_temp.tenta('non-admin NON si aggiunge ad admins', 'insert into public.admins values (''00000000-0000-0000-0000-0000000000b2'')', false);
select pg_temp.tenta('non-admin chiama reorder (ma non cambia nulla)', 'select public.reorder_gallery(array[(select id from public.gallery_photos where legacy_key = ''gal-17'')])', true);
select pg_temp.tenta('non-admin NON scrive su Storage', 'insert into storage.objects (bucket_id, name) values (''gallery'', ''x.webp'')', false);
select pg_temp.tenta('non-admin NON elenca Storage', 'select 1 from storage.objects', false);
reset role;

-- il riordino del non-admin non deve aver cambiato nulla
do $$ begin
  if (select position from public.gallery_photos where legacy_key = 'gal-17') <> 9 then
    raise exception 'FALLITO: il non-admin ha cambiato l''ordine'; end if; end $$;

-- admin
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.tenta('admin inserisce una foto', :'foto', true);
select pg_temp.tenta('admin NON inserisce un percorso con ../', 'insert into public.gallery_photos (position, storage_path, ext, width, height) values (0, ''../x'', ''webp'', 8, 8)', false);
select pg_temp.tenta('admin NON inserisce categoria inventata', 'insert into public.gallery_photos (position, legacy_key, category) values (0, ''gal-99'', ''altro'')', false);
select pg_temp.tenta('admin NON inserisce didascalia lunga', 'insert into public.gallery_photos (position, legacy_key, caption) values (0, ''gal-98'', repeat(''a'', 141))', false);
select pg_temp.tenta('admin modifica', 'update public.gallery_photos set caption = ''ok'' where storage_path = ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''', true);
select pg_temp.tenta('admin riordina', 'select public.reorder_gallery(array(select id from public.gallery_photos order by position desc))', true);
select pg_temp.tenta('admin scrive su Storage', 'insert into storage.objects (bucket_id, name) values (''gallery'', ''x.webp'')', true);
select pg_temp.tenta('admin elenca Storage', 'select 1 from storage.objects', true);
select pg_temp.tenta('admin NON scrive in un altro bucket', 'insert into storage.objects (bucket_id, name) values (''altro'', ''x.webp'')', false);
select pg_temp.tenta('admin elimina la foto', 'delete from public.gallery_photos where storage_path = ''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''', true);
reset role;

select format('%s %s', case when ok then 'OK    ' else 'ERRORE' end, nome) as esito from risultati;
select format('%s prove, %s fallite', count(*), count(*) filter (where not ok)) as riepilogo from risultati;
