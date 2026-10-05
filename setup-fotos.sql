-- Execute este script completo no SQL Editor do projeto Supabase do app.
-- Preserva todas as tarefas e contas existentes.
begin;
alter table public.checklist_tasks add column if not exists description text not null default '';
grant update (description) on public.checklist_tasks to authenticated;
create table if not exists public.checklist_task_photos (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.checklist_tasks(id) on delete cascade,
 path text not null unique,
 name text not null check (char_length(name) between 1 and 250),
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 constraint checklist_photo_path check (
   split_part(path, '/', 1) = task_id::text
   and path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|png|webp)$'
 )
);
create index if not exists checklist_photos_task_id on public.checklist_task_photos(task_id);
alter table public.checklist_task_photos enable row level security;
revoke all on public.checklist_task_photos from anon, authenticated;
grant select, delete on public.checklist_task_photos to authenticated;
grant insert (task_id, path, name) on public.checklist_task_photos to authenticated;
drop policy if exists checklist_photos_select on public.checklist_task_photos;
create policy checklist_photos_select on public.checklist_task_photos for select to authenticated
using (exists (select 1 from public.checklist_members where user_id = (select auth.uid())));
drop policy if exists checklist_photos_insert on public.checklist_task_photos;
create policy checklist_photos_insert on public.checklist_task_photos for insert to authenticated
with check (created_by = (select auth.uid()) and exists (select 1 from public.checklist_members where user_id = (select auth.uid())));
drop policy if exists checklist_photos_delete on public.checklist_task_photos;
create policy checklist_photos_delete on public.checklist_task_photos for delete to authenticated
using (exists (select 1 from public.checklist_members where user_id = (select auth.uid())));
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checklist-photos', 'checklist-photos', false, 10485760,
 array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false,
file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists checklist_storage_read on storage.objects;
create policy checklist_storage_read on storage.objects for select to authenticated
using (bucket_id = 'checklist-photos' and exists (select 1 from public.checklist_members where user_id = (select auth.uid())));
drop policy if exists checklist_storage_upload on storage.objects;
create policy checklist_storage_upload on storage.objects for insert to authenticated
with check (bucket_id = 'checklist-photos'
 and exists (select 1 from public.checklist_members where user_id = (select auth.uid()))
 and exists (select 1 from public.checklist_tasks where id::text = (storage.foldername(name))[1]));
drop policy if exists checklist_storage_delete on storage.objects;
create policy checklist_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'checklist-photos' and exists (select 1 from public.checklist_members where user_id = (select auth.uid())));
do $$
begin
 if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
   and schemaname = 'public' and tablename = 'checklist_task_photos') then
  alter publication supabase_realtime add table public.checklist_task_photos;
 end if;
end;
$$;
commit;
