begin;
create extension if not exists pg_net with schema extensions;
-- Execute depois do supabase-setup.sql. Nao altera tarefas existentes.
alter table public.checklist_tasks add column if not exists created_by uuid default auth.uid();
create table if not exists public.checklist_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 endpoint text not null unique check (length(endpoint) between 20 and 3000),
 p256dh text not null check (length(p256dh) between 80 and 100),
 auth text not null check (length(auth) between 20 and 30),
 updated_at timestamptz not null default now()
);
alter table public.checklist_push_subscriptions enable row level security;
revoke all on public.checklist_push_subscriptions from anon, authenticated;
grant select,delete on public.checklist_push_subscriptions to authenticated;
grant insert(endpoint,p256dh,auth,updated_at),update(p256dh,auth,updated_at) on public.checklist_push_subscriptions to authenticated;
drop policy if exists checklist_push_own on public.checklist_push_subscriptions;
create policy checklist_push_own on public.checklist_push_subscriptions for all to authenticated
 using (user_id = auth.uid() and exists(select 1 from public.checklist_members where user_id=auth.uid()))
 with check (user_id = auth.uid() and exists(select 1 from public.checklist_members where user_id=auth.uid()));
-- O segredo deve existir no Vault com o nome checklist_push_webhook_secret.
-- Ele deve ter o mesmo valor de PUSH_WEBHOOK_SECRET na Vercel.
-- Nao coloque a chave service_role ou a chave anon neste campo.
-- Desliga qualquer envio automatico instalado pela versao anterior.
drop trigger if exists checklist_notify_new_task on public.checklist_tasks;
drop function if exists public.checklist_notify_new_task();
create table if not exists public.checklist_notification_requests (
 task_id uuid primary key references public.checklist_tasks(id) on delete cascade,
 requested_by uuid not null references auth.users(id) on delete cascade,
 requested_at timestamptz not null default now()
);
alter table public.checklist_notification_requests enable row level security;
revoke all on public.checklist_notification_requests from public,anon,authenticated;
create or replace function public.checklist_request_task_notification(task_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare
 v_task_id uuid := task_id;
 requester uuid := auth.uid();
 task_title text;
 webhook_secret text;
 recipients jsonb := '[]'::jsonb;
 subscription_row record;
 recipient_count integer := 0;
begin
 if requester is null or not exists(select 1 from public.checklist_members m where m.user_id=requester) then
  raise exception 'Equipe nao autorizada' using errcode='42501';
 end if;
 -- Serializa cliques simultaneos e evita disparos repetidos em menos de 1 minuto.
 select t.title into task_title from public.checklist_tasks t where t.id=v_task_id for update;
 if not found then raise exception 'Tarefa indisponivel' using errcode='P0002'; end if;
 if exists(select 1 from public.checklist_notification_requests h where h.task_id=v_task_id and h.requested_at>now()-interval '60 seconds') then
  raise exception 'push_recently_requested';
 end if;
 select decrypted_secret into webhook_secret from vault.decrypted_secrets
 where name='checklist_push_webhook_secret' limit 1;
 if webhook_secret is null then raise exception 'push_not_configured'; end if;
 for subscription_row in
  select s.endpoint,s.p256dh,s.auth from public.checklist_push_subscriptions s
  join public.checklist_members m on m.user_id=s.user_id
  where s.user_id<>requester
 loop
  recipient_count := recipient_count+1;
  recipients := recipients || jsonb_build_array(jsonb_build_object('endpoint',subscription_row.endpoint,
   'keys',jsonb_build_object('p256dh',subscription_row.p256dh,'auth',subscription_row.auth)));
  if jsonb_array_length(recipients)=100 then
   perform net.http_post(url:='https://tarefas-nucleo.vercel.app/api/task-push',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||webhook_secret),
    body:=jsonb_build_object('taskId',v_task_id,'title',task_title,'subscriptions',recipients),timeout_milliseconds:=60000);
   recipients := '[]'::jsonb;
  end if;
 end loop;
 if jsonb_array_length(recipients)>0 then
  perform net.http_post(url:='https://tarefas-nucleo.vercel.app/api/task-push',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||webhook_secret),
   body:=jsonb_build_object('taskId',v_task_id,'title',task_title,'subscriptions',recipients),timeout_milliseconds:=60000);
 end if;
 if recipient_count>0 then
  insert into public.checklist_notification_requests(task_id,requested_by,requested_at)
  values(v_task_id,requester,now())
  on conflict(task_id) do update set requested_by=excluded.requested_by,requested_at=excluded.requested_at;
 end if;
 return recipient_count;
end $$;
revoke all on function public.checklist_request_task_notification(uuid) from public,anon,authenticated;
grant execute on function public.checklist_request_task_notification(uuid) to authenticated;
commit;
