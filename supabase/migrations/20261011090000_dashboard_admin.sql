-- =============================================================================
-- Kenalan — Dashboard admin and report moderation
--
-- Apply after the existing schema/RLS/RPC migrations. No admin is created
-- automatically; bootstrap the first trusted admin manually as described in
-- docs/DASHBOARD_PLAN.md.
-- =============================================================================

-- Current frontend profile fields that are also useful to admin views.
alter table public.profiles
  add column if not exists is_discoverable boolean not null default true,
  add column if not exists stamp_history_public boolean not null default false,
  add column if not exists whatsapp text not null default '',
  add column if not exists line text not null default '',
  add column if not exists social_visibility jsonb not null default
    '{"instagram":"public","linkedin":"public","spotify":"public","whatsapp":"off","line":"off"}'::jsonb;

-- Reports are user-submitted through the member app and reviewed by staff.
create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null,
  reported_id    uuid,
  target_stamp_id uuid,
  report_type    text not null default 'user',
  reason         text not null default '',
  status         text not null default 'pending',
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz,
  reviewed_by    uuid,

  constraint reports_reporter_id_fkey foreign key (reporter_id)
    references public.profiles (id) on delete cascade,
  constraint reports_reported_id_fkey foreign key (reported_id)
    references public.profiles (id) on delete set null,
  constraint reports_target_stamp_id_fkey foreign key (target_stamp_id)
    references public.location_stamps (id) on delete set null,
  constraint reports_reviewed_by_fkey foreign key (reviewed_by)
    references auth.users (id) on delete set null,
  constraint reports_type_check check (report_type in ('user', 'stamp')),
  constraint reports_status_check check (status in ('pending', 'resolved', 'dismissed')),
  constraint reports_no_self_report check (reported_id is null or reporter_id <> reported_id)
);

create index if not exists reports_status_created_at_idx
  on public.reports (status, created_at desc);
create index if not exists reports_reported_id_idx
  on public.reports (reported_id);

create table if not exists public.dashboard_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('admin', 'moderator', 'superadmin')),
  created_at timestamptz not null default now()
);

create table if not exists public.dashboard_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists dashboard_audit_logs_created_at_idx
  on public.dashboard_audit_logs (created_at desc);

alter table public.dashboard_admins enable row level security;
alter table public.dashboard_audit_logs enable row level security;
alter table public.reports enable row level security;
alter table public.nfc_tokens enable row level security;

-- Role checks are performed against the authenticated caller, never a client
-- supplied user id or role claim.
create or replace function public.dashboard_has_role(p_roles text[])
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.dashboard_admins a
    where a.user_id = auth.uid()
      and a.role = any (p_roles)
  );
$$;

revoke all on function public.dashboard_has_role(text[]) from public, anon;
grant execute on function public.dashboard_has_role(text[]) to authenticated;

create or replace function public.dashboard_get_my_role()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select a.role
  from public.dashboard_admins a
  where a.user_id = auth.uid();
$$;

revoke all on function public.dashboard_get_my_role() from public, anon;
grant execute on function public.dashboard_get_my_role() to authenticated;

create or replace function public.dashboard_count_unclaimed_tokens()
returns bigint
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not public.dashboard_has_role(array['admin', 'moderator', 'superadmin']) then
    raise exception 'DASHBOARD_FORBIDDEN: akses dashboard diperlukan'
      using errcode = '42501';
  end if;

  return (
    select count(*)
    from public.nfc_tokens t
    where t.status = 'unclaimed'
  );
end;
$$;

revoke all on function public.dashboard_count_unclaimed_tokens() from public, anon;
grant execute on function public.dashboard_count_unclaimed_tokens() to authenticated;

create or replace function public.dashboard_user_activity_counts(p_user_id uuid)
returns table (token_count bigint, stamp_count bigint, report_count bigint)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not public.dashboard_has_role(array['admin', 'moderator', 'superadmin']) then
    raise exception 'DASHBOARD_FORBIDDEN: akses dashboard diperlukan'
      using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.nfc_tokens t where t.user_id = p_user_id),
    (select count(*) from public.location_stamps s where s.user_id = p_user_id),
    (select count(*) from public.reports r where r.reported_id = p_user_id);
end;
$$;

revoke all on function public.dashboard_user_activity_counts(uuid) from public, anon;
grant execute on function public.dashboard_user_activity_counts(uuid) to authenticated;

drop policy if exists dashboard_admins_select_self_or_admin on public.dashboard_admins;
create policy dashboard_admins_select_self_or_admin
  on public.dashboard_admins for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.dashboard_has_role(array['superadmin'])
  );

drop policy if exists dashboard_audit_select_admin on public.dashboard_audit_logs;
create policy dashboard_audit_select_admin
  on public.dashboard_audit_logs for select
  to authenticated
  using (public.dashboard_has_role(array['admin', 'superadmin']));

-- Members can create a report only as themselves. Only dashboard RPCs can
-- review or modify reports.
drop policy if exists reports_insert_self on public.reports;
create policy reports_insert_self
  on public.reports for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and (
      (report_type = 'user' and reported_id is not null)
      or (report_type = 'stamp' and target_stamp_id is not null)
    )
  );

drop policy if exists reports_select_admin on public.reports;
create policy reports_select_admin
  on public.reports for select
  to authenticated
  using (public.dashboard_has_role(array['admin', 'moderator', 'superadmin']));

-- nfc_tokens has intentionally denied direct access. Permit only read access
-- to admins; creation remains inside the audited SECURITY DEFINER RPC below.
drop policy if exists nfc_tokens_select_dashboard_admin on public.nfc_tokens;
create policy nfc_tokens_select_dashboard_admin
  on public.nfc_tokens for select
  to authenticated
  using (public.dashboard_has_role(array['admin', 'superadmin']));

grant select on public.dashboard_admins to authenticated;
grant select on public.dashboard_audit_logs to authenticated;
grant select, insert on public.reports to authenticated;
grant select on public.nfc_tokens to authenticated;
revoke insert, update, delete on public.dashboard_admins from anon, authenticated;
revoke insert, update, delete on public.dashboard_audit_logs from anon, authenticated;
revoke update, delete on public.reports from anon, authenticated;
revoke insert, update, delete on public.nfc_tokens from anon, authenticated;

create or replace function public.dashboard_create_nfc_token(p_batch_label text default null)
returns public.nfc_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_token text;
  v_row public.nfc_tokens;
begin
  if v_actor is null or not public.dashboard_has_role(array['admin', 'superadmin']) then
    raise exception 'DASHBOARD_FORBIDDEN: akses admin diperlukan'
      using errcode = '42501';
  end if;

  loop
    v_token := 'KNL-' || upper(encode(extensions.gen_random_bytes(12), 'hex'));
    exit when not exists (
      select 1 from public.nfc_tokens t where t.token = v_token
    );
  end loop;

  insert into public.nfc_tokens (token, status, batch_label)
  values (v_token, 'unclaimed', nullif(left(btrim(p_batch_label), 80), ''))
  returning * into v_row;

  insert into public.dashboard_audit_logs (actor_id, action, target_type, target_id, details)
  values (
    v_actor,
    'nfc_token.created',
    'nfc_token',
    v_row.id::text,
    jsonb_build_object('batch_label', v_row.batch_label)
  );

  return v_row;
end;
$$;

revoke all on function public.dashboard_create_nfc_token(text) from public, anon;
grant execute on function public.dashboard_create_nfc_token(text) to authenticated;

create or replace function public.dashboard_set_report_status(p_report_id uuid, p_status text)
returns public.reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_report public.reports;
  v_previous_status text;
begin
  if v_actor is null or not public.dashboard_has_role(array['admin', 'moderator', 'superadmin']) then
    raise exception 'DASHBOARD_FORBIDDEN: akses moderator diperlukan'
      using errcode = '42501';
  end if;

  if p_status not in ('resolved', 'dismissed') then
    raise exception 'INVALID_STATUS: status laporan tidak valid'
      using errcode = '22023';
  end if;

  select r.status into v_previous_status
  from public.reports r
  where r.id = p_report_id
  for update;

  if not found then
    raise exception 'REPORT_NOT_FOUND: laporan tidak ditemukan'
      using errcode = 'P0002';
  end if;

  update public.reports r
     set status = p_status,
         reviewed_at = now(),
         reviewed_by = v_actor
   where r.id = p_report_id
  returning r.* into v_report;

  insert into public.dashboard_audit_logs (actor_id, action, target_type, target_id, details)
  values (
    v_actor,
    'report.status_changed',
    'report',
    p_report_id::text,
    jsonb_build_object('from', v_previous_status, 'to', p_status)
  );

  return v_report;
end;
$$;

revoke all on function public.dashboard_set_report_status(uuid, text) from public, anon;
grant execute on function public.dashboard_set_report_status(uuid, text) to authenticated;

comment on table public.dashboard_admins is
  'Trusted dashboard roles. Add the first superadmin manually from the SQL editor after verifying the auth user id.';
comment on table public.dashboard_audit_logs is
  'Append-only audit entries written by trusted dashboard RPCs.';
