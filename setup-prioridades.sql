-- Execute todo este codigo no SQL Editor do Supabase.
begin;
alter table public.checklist_tasks
 add column if not exists priority text not null default 'low'
 constraint checklist_tasks_priority_check check (priority in ('low','medium','high'));
grant insert (priority), update (priority) on public.checklist_tasks to authenticated;
notify pgrst, 'reload schema';
commit;
