-- Apply once using Supabase migrations, never using browser credentials.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id),
 role text not null default 'worker' check (role in ('worker','admin'))
);
create function public.is_admin() returns boolean language sql stable security definer
set search_path = '' as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
create table public.work_records (
 id uuid primary key,
 owner_id uuid not null references public.profiles(id),
 payload jsonb not null,
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create table public.record_history (
 id bigint generated always as identity primary key,
 record_id uuid not null references public.work_records(id),
 actor_id uuid not null,
 action text not null,
 revision integer not null,
 payload jsonb not null,
 occurred_at timestamptz not null default now()
);
create table public.archive_exports (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 snapshot jsonb not null,
 confirmed_at timestamptz,
 confirmed_by uuid
);
alter table public.profiles enable row level security;
alter table public.work_records enable row level security;
alter table public.record_history enable row level security;
alter table public.archive_exports enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy records_read on public.work_records for select to authenticated using (public.is_admin() or (owner_id=auth.uid() and deleted_at is null));
create policy history_read on public.record_history for select to authenticated using (public.is_admin() or exists(select 1 from public.work_records r where r.id=record_id and r.owner_id=auth.uid() and r.deleted_at is null));
create policy exports_read on public.archive_exports for select to authenticated using (public.is_admin());
grant select on public.profiles, public.work_records, public.record_history, public.archive_exports to authenticated;
revoke insert,update,delete on public.profiles,public.work_records,public.record_history,public.archive_exports from authenticated,anon;

create function public.validate_payload(p jsonb) returns void language plpgsql set search_path = '' as $$
begin
 if jsonb_typeof(p) <> 'object' or p is null
  or not (p ?& array['lot','date','process','quantity','note'])
  or jsonb_typeof(p->'lot') <> 'string' or length(btrim(p->>'lot')) not between 1 and 80
  or jsonb_typeof(p->'note') <> 'string' or length(p->>'note') > 2000
  or coalesce(p->>'process','') not in ('仕込み','発酵管理','蒸留')
  or coalesce(p->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
  or (p->>'quantity' <> '' and ((p->>'quantity') !~ '^(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$' or length(p->>'quantity') > 100))
  or jsonb_typeof(p->'quantity') <> 'string'
 then raise exception 'Invalid record'; end if;
 perform (p->>'date')::date;
end $$;

create function public.submit_record(p_id uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.work_records;
begin
 if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'Not authorized'; end if;
 perform public.validate_payload(p_payload);
 -- Idempotency survives lost responses and simultaneous retries.
 insert into public.work_records(id,owner_id,payload) values(p_id,auth.uid(),p_payload) on conflict do nothing;
 if found then
  insert into public.record_history(record_id,actor_id,action,revision,payload) values(p_id,auth.uid(),'create',1,p_payload);
 else
  select * into existing from public.work_records where id=p_id;
  if existing.owner_id <> auth.uid() or existing.payload <> p_payload or existing.deleted_at is not null then raise exception 'Idempotency conflict'; end if;
 end if;
 return p_id;
end $$;

create function public.change_record(p_id uuid,p_revision integer,p_action text,p_payload jsonb default null) returns void language plpgsql security definer set search_path = '' as $$
declare r public.work_records;
begin
 select * into r from public.work_records where id=p_id for update;
 if not found or auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) or not (public.is_admin() or r.owner_id=auth.uid()) then raise exception 'Not authorized'; end if;
 if r.revision <> p_revision then raise exception 'Record changed; reload before editing'; end if;
 if p_action = 'edit' then
  if r.deleted_at is not null then raise exception 'Record deleted'; end if;
  perform public.validate_payload(p_payload);
  update public.work_records set payload=p_payload where id=p_id;
 elsif p_action = 'delete' then
  if not public.is_admin() or r.deleted_at is not null then raise exception 'Not authorized or already deleted'; end if;
  update public.work_records set deleted_at=clock_timestamp() where id=p_id;
 elsif p_action = 'restore' then
  if not public.is_admin() or r.deleted_at is null or clock_timestamp() >= r.deleted_at + interval '24 hours' then raise exception 'Restore unavailable'; end if;
  update public.work_records set deleted_at=null where id=p_id;
 else raise exception 'Invalid action'; end if;
 update public.work_records set revision=revision+1,updated_at=clock_timestamp() where id=p_id;
 insert into public.record_history(record_id,actor_id,action,revision,payload)
 select id,auth.uid(),p_action,revision,payload from public.work_records where id=p_id;
end $$;

create function public.create_archive() returns uuid language plpgsql security definer set search_path = '' as $$
declare export_id uuid;
begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 -- Immutable snapshot: a later edit cannot silently change the downloaded data.
 insert into public.archive_exports(created_by,snapshot)
 values(auth.uid(),jsonb_build_object('schema_version',1,
  'records',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from public.work_records r),'[]'::jsonb),
  'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.id) from public.record_history h),'[]'::jsonb)))
 returning id into export_id;
 return export_id;
end $$;
create function public.confirm_archive(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise exception 'Not authorized'; end if;
 update public.archive_exports set confirmed_at=coalesce(confirmed_at,clock_timestamp()),confirmed_by=coalesce(confirmed_by,auth.uid()) where id=p_id;
 if not found then raise exception 'Archive missing'; end if;
end $$;
-- No automatic physical deletion until production completion and split/merge dependencies are modeled.
revoke all on function public.is_admin(),public.validate_payload(jsonb),public.submit_record(uuid,jsonb),public.change_record(uuid,integer,text,jsonb),public.create_archive(),public.confirm_archive(uuid) from public;
grant execute on function public.is_admin(),public.submit_record(uuid,jsonb),public.change_record(uuid,integer,text,jsonb),public.create_archive(),public.confirm_archive(uuid) to authenticated;
commit;
