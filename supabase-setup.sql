-- Checklist compartilhado: execute uma vez no SQL Editor do Supabase.
-- Todos os membros autorizados veem e editam a mesma lista.
begin;
create table if not exists public.checklist_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.checklist_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 300),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.checklist_members enable row level security;
alter table public.checklist_tasks enable row level security;
revoke all on public.checklist_members from anon, authenticated;
revoke all on public.checklist_tasks from anon, authenticated;
grant select on public.checklist_members to authenticated;
grant select, delete on public.checklist_tasks to authenticated;
grant insert (title) on public.checklist_tasks to authenticated;
grant update (title, done) on public.checklist_tasks to authenticated;
drop policy if exists checklist_own_membership on public.checklist_members;
create policy checklist_own_membership on public.checklist_members
for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists checklist_team_access on public.checklist_tasks;
create policy checklist_team_access on public.checklist_tasks
for all to authenticated
using (exists (select 1 from public.checklist_members where user_id = (select auth.uid())))
with check (exists (select 1 from public.checklist_members where user_id = (select auth.uid())));
create or replace function public.checklist_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
drop trigger if exists checklist_updated_at on public.checklist_tasks;
create trigger checklist_updated_at before update on public.checklist_tasks
for each row execute function public.checklist_set_updated_at();
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'checklist_tasks') then
    alter publication supabase_realtime add table public.checklist_tasks;
  end if;
end;
$$;
commit;
-- Depois, crie as contas em Authentication > Users e autorize os e-mails:
-- insert into public.checklist_members (user_id)
-- select id from auth.users
-- where email in ('pessoa1@email.com', 'pessoa2@email.com', 'pessoa3@email.com')
-- on conflict do nothing;
