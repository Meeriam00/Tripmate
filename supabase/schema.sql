-- =============================================================================
-- TRIPMATE — Supabase / PostgreSQL schema
--
-- Run once in the Supabase SQL editor (or `supabase db push`).
--
-- Design:
--   * Money is bigint minor units (cents / qəpik). Never numeric floats.
--   * Row Level Security is ON for every table. Clients may only SELECT what
--     belongs to their trips; every write goes through a SECURITY DEFINER
--     function below that validates input and checks the caller's role.
--   * A payment only reduces a debt once the RECEIVER confirms it
--     (resolve_payment). Rows are locked FOR UPDATE, so a payment can be
--     confirmed exactly once.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  first_name  text not null default '',
  last_name   text not null default '',
  avatar_url  text,
  currency    text not null default 'AZN',
  language    text not null default 'az' check (language = 'az'),
  theme       text not null default 'system' check (theme in ('light', 'dark', 'system')),
  notify      jsonb not null default '{"expenses": true, "payments": true, "members": true}',
  completed   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.trips (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(trim(name)) between 1 and 60),
  destination  text not null check (char_length(trim(destination)) between 1 and 80),
  start_date   date not null,
  end_date     date not null,
  currency     text not null check (currency in ('AZN', 'EUR', 'USD', 'TRY', 'GBP', 'GEL')),
  budget       bigint check (budget is null or budget > 0),
  cover_url    text,
  invite_code  text not null unique,
  created_by   uuid references auth.users (id) on delete set null,
  archived     boolean not null default false,
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.trip_members (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete set null,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  avatar_url  text,
  role        text not null default 'member' check (role in ('admin', 'member')),
  status      text not null default 'active' check (status in ('active', 'removed')),
  joined_at   timestamptz not null default now()
);
create unique index if not exists trip_members_one_seat_per_user
  on public.trip_members (trip_id, user_id) where user_id is not null and status = 'active';
create index if not exists trip_members_user on public.trip_members (user_id);

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  title        text not null check (char_length(trim(title)) between 1 and 80),
  amount       bigint not null check (amount > 0),
  category     text not null check (category in ('stay', 'food', 'transport', 'fun', 'shopping', 'other')),
  paid_by      uuid not null references public.trip_members (id),
  method       text not null check (method in ('equal', 'custom', 'percent')),
  percents     jsonb,
  date         date not null,
  note         text check (note is null or char_length(note) <= 300),
  receipt_url  text,
  created_by   uuid not null references public.trip_members (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists expenses_trip on public.expenses (trip_id);

create table if not exists public.expense_shares (
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  member_id   uuid not null references public.trip_members (id),
  amount      bigint not null check (amount >= 0),
  primary key (expense_id, member_id)
);

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips (id) on delete cascade,
  from_member  uuid not null references public.trip_members (id),
  to_member    uuid not null references public.trip_members (id),
  amount       bigint not null check (amount > 0),
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_by   uuid not null references public.trip_members (id),
  created_at   timestamptz not null default now(),
  resolved_by  uuid references public.trip_members (id),
  resolved_at  timestamptz,
  check (from_member <> to_member)
);
create index if not exists payments_trip on public.payments (trip_id);

create table if not exists public.activity (
  id       uuid primary key default gen_random_uuid(),
  trip_id  uuid not null references public.trips (id) on delete cascade,
  kind     text not null,
  actor    uuid references public.trip_members (id),
  data     jsonb not null default '{}',
  at       timestamptz not null default now()
);
create index if not exists activity_trip on public.activity (trip_id, at desc);

create table if not exists public.notifications (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users (id) on delete cascade,
  trip_id  uuid references public.trips (id) on delete cascade,
  kind     text not null,
  text     text not null,
  link     text not null,
  read     boolean not null default false,
  at       timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.tm_error(msg text) returns void
language plpgsql as $$ begin raise exception using message = msg, errcode = 'P0001'; end $$;

-- The caller's active seat in a trip (null if none).
create or replace function public.my_member(p_trip uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from trip_members where trip_id = p_trip and user_id = auth.uid() and status = 'active' limit 1
$$;

create or replace function public.is_trip_member(p_trip uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from trip_members where trip_id = p_trip and user_id = auth.uid() and status = 'active')
$$;

-- "1.234,50 €" — same format as the app.
create or replace function public.fmt_money(p_amount bigint, p_currency text) returns text
language sql immutable as $$
  select (case when p_amount < 0 then '−' else '' end)
    || regexp_replace((abs(p_amount) / 100)::text, '(\d)(?=(\d{3})+$)', '\1.', 'g')
    || ',' || lpad((abs(p_amount) % 100)::text, 2, '0') || ' '
    || case p_currency when 'AZN' then '₼' when 'EUR' then '€' when 'USD' then '$' when 'TRY' then '₺'
                       when 'GBP' then '£' when 'GEL' then '₾' else p_currency end
$$;

-- Outstanding balance of a seat: paid − share + confirmed sent − confirmed received.
create or replace function public.member_outstanding(p_member uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(amount) from expenses where paid_by = p_member), 0)
       - coalesce((select sum(amount) from expense_shares where member_id = p_member), 0)
       + coalesce((select sum(amount) from payments where from_member = p_member and status = 'confirmed'), 0)
       - coalesce((select sum(amount) from payments where to_member = p_member and status = 'confirmed'), 0)
$$;

create or replace function public.tm_notify(p_user uuid, p_trip uuid, p_kind text, p_text text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
declare pref text; ok boolean;
begin
  if p_user is null or p_user = auth.uid() then return; end if;
  pref := case p_kind when 'expense_added' then 'expenses' when 'balance_updated' then 'expenses'
                      when 'payment_sent' then 'payments' when 'payment_confirmed' then 'payments'
                      when 'payment_rejected' then 'payments' when 'member_joined' then 'members' else null end;
  select coalesce(pref is null or (notify ->> pref)::boolean, true) into ok from profiles where id = p_user;
  if coalesce(ok, false) then
    insert into notifications (user_id, trip_id, kind, text, link) values (p_user, p_trip, p_kind, p_text, p_link);
  end if;
end $$;

create or replace function public.tm_new_invite_code() returns text language plpgsql as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; i int;
begin
  loop
    code := '';
    for i in 1..6 loop code := code || substr(alphabet, 1 + floor(random() * 32)::int, 1); end loop;
    exit when not exists (select 1 from trips where invite_code = code);
  end loop;
  return code;
end $$;

-- New auth user → profile (Google sign-ups bring their name along).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare full_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '');
begin
  insert into profiles (id, email, first_name, last_name, avatar_url)
  values (new.id, coalesce(new.email, ''), split_part(full_name, ' ', 1),
          coalesce(substr(full_name, char_length(split_part(full_name, ' ', 1)) + 2), ''),
          new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Keep seats in sync with the profile name / photo.
create or replace function public.sync_member_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update trip_members set
    name = coalesce(nullif(trim(new.first_name || ' ' || new.last_name), ''), split_part(new.email, '@', 1)),
    avatar_url = new.avatar_url
  where user_id = new.id;
  return new;
end $$;
drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated after update of first_name, last_name, avatar_url on public.profiles
  for each row execute function public.sync_member_profile();

-- ---------------------------------------------------------------------------
-- Row Level Security: read access only. Writes use the functions below.
-- ---------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.trips          enable row level security;
alter table public.trip_members   enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_shares enable row level security;
alter table public.payments       enable row level security;
alter table public.activity       enable row level security;
alter table public.notifications  enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select using (id = auth.uid());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "members read trip" on public.trips;
create policy "members read trip" on public.trips for select using (public.is_trip_member(id));
drop policy if exists "members read members" on public.trip_members;
create policy "members read members" on public.trip_members for select using (public.is_trip_member(trip_id));
drop policy if exists "members read expenses" on public.expenses;
create policy "members read expenses" on public.expenses for select using (public.is_trip_member(trip_id));
drop policy if exists "members read shares" on public.expense_shares;
create policy "members read shares" on public.expense_shares for select
  using (exists (select 1 from public.expenses e where e.id = expense_id and public.is_trip_member(e.trip_id)));
drop policy if exists "members read payments" on public.payments;
create policy "members read payments" on public.payments for select using (public.is_trip_member(trip_id));
drop policy if exists "members read activity" on public.activity;
create policy "members read activity" on public.activity for select using (public.is_trip_member(trip_id));
drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "mark own notifications" on public.notifications;
create policy "mark own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Profiles may only change these columns from the client.
revoke update on public.profiles from anon, authenticated;
grant update (first_name, last_name, avatar_url, currency, language, theme, notify, completed) on public.profiles to authenticated;
revoke update on public.notifications from anon, authenticated;
grant update (read) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Trips
-- ---------------------------------------------------------------------------

create or replace function public.create_trip(
  p_name text, p_destination text, p_start date, p_end date, p_currency text,
  p_budget bigint, p_cover text, p_participants text[]
) returns public.trips
language plpgsql security definer set search_path = public as $$
declare t trips; me profiles; n text; my_name text; i int := 0;
begin
  if auth.uid() is null then perform tm_error('Sessiya bitib. Yenidən daxil olun.'); end if;
  if p_end < p_start then perform tm_error('Bitmə tarixi başlanğıcdan əvvəl ola bilməz.'); end if;
  if coalesce(array_length(p_participants, 1), 0) > 30 then perform tm_error('Bir səfərdə ən çox 30 iştirakçı ola bilər.'); end if;
  select * into me from profiles where id = auth.uid();
  my_name := coalesce(nullif(trim(me.first_name || ' ' || me.last_name), ''), split_part(me.email, '@', 1));
  insert into trips (name, destination, start_date, end_date, currency, budget, cover_url, invite_code, created_by)
  values (trim(p_name), trim(p_destination), p_start, p_end, p_currency, p_budget, p_cover, tm_new_invite_code(), auth.uid())
  returning * into t;
  insert into trip_members (trip_id, user_id, name, avatar_url, role) values (t.id, auth.uid(), my_name, me.avatar_url, 'admin');
  foreach n in array coalesce(p_participants, '{}') loop
    n := trim(n);
    if n <> '' and lower(n) <> lower(my_name) then
      i := i + 1;
      insert into trip_members (trip_id, name, joined_at) values (t.id, n, now() + make_interval(secs => i * 0.001));
    end if;
  end loop;
  insert into activity (trip_id, kind, actor, data) values (t.id, 'trip_created', my_member(t.id), jsonb_build_object('title', t.name));
  return t;
end $$;

create or replace function public.update_trip(
  p_trip uuid, p_name text, p_destination text, p_start date, p_end date, p_currency text, p_budget bigint, p_cover text
) returns void
language plpgsql security definer set search_path = public as $$
declare t trips; me trip_members;
begin
  select * into t from trips where id = p_trip for update;
  select * into me from trip_members where id = my_member(p_trip);
  if t.id is null or me.id is null then perform tm_error('Bu səfərə girişiniz yoxdur.'); end if;
  if me.role <> 'admin' then perform tm_error('Səfəri yalnız admin dəyişə bilər.'); end if;
  if t.archived then perform tm_error('Səfər arxivdədir. Dəyişiklik üçün əvvəlcə arxivdən çıxarın.'); end if;
  if p_currency <> t.currency and exists (select 1 from expenses where trip_id = p_trip) then
    perform tm_error('Xərclər yazılmış səfərin valyutasını dəyişmək olmaz.');
  end if;
  update trips set name = trim(p_name), destination = trim(p_destination), start_date = p_start, end_date = p_end,
    currency = p_currency, budget = p_budget, cover_url = p_cover where id = p_trip;
  insert into activity (trip_id, kind, actor, data) values (p_trip, 'trip_updated', me.id, jsonb_build_object('title', trim(p_name)));
end $$;

create or replace function public.set_trip_archived(p_trip uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me trip_members;
begin
  select * into me from trip_members where id = my_member(p_trip);
  if me.id is null or me.role <> 'admin' then perform tm_error('Səfəri yalnız admin arxivləyə bilər.'); end if;
  update trips set archived = p_archived where id = p_trip;
  insert into activity (trip_id, kind, actor, data)
  values (p_trip, case when p_archived then 'trip_archived' else 'trip_unarchived' end, me.id,
          jsonb_build_object('title', (select name from trips where id = p_trip)));
end $$;

create or replace function public.preview_invite(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t trips;
begin
  if auth.uid() is null then perform tm_error('Sessiya bitib. Yenidən daxil olun.'); end if;
  select * into t from trips where invite_code = upper(trim(p_code));
  if t.id is null then perform tm_error('Dəvət kodu tapılmadı. Kodu yoxlayın.'); end if;
  return jsonb_build_object(
    'tripId', t.id, 'name', t.name, 'destination', t.destination, 'startDate', t.start_date, 'endDate', t.end_date,
    'memberCount', (select count(*) from trip_members where trip_id = t.id and status = 'active'),
    'openSeats', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by joined_at)
                           from trip_members where trip_id = t.id and status = 'active' and user_id is null), '[]'),
    'alreadyMember', exists (select 1 from trip_members where trip_id = t.id and user_id = auth.uid() and status = 'active'));
end $$;

create or replace function public.join_trip(p_code text, p_claim uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare t trips; me profiles; seat trip_members; u uuid;
begin
  if auth.uid() is null then perform tm_error('Sessiya bitib. Yenidən daxil olun.'); end if;
  select * into t from trips where invite_code = upper(trim(p_code));
  if t.id is null then perform tm_error('Dəvət kodu tapılmadı. Kodu yoxlayın.'); end if;
  if t.archived then perform tm_error('Bu səfər arxivlənib, ona qoşulmaq olmur.'); end if;
  if my_member(t.id) is not null then return t.id; end if;
  select * into me from profiles where id = auth.uid();
  if p_claim is not null then
    update trip_members set user_id = auth.uid(), avatar_url = me.avatar_url
      where id = p_claim and trip_id = t.id and status = 'active' and user_id is null
      returning * into seat;
    if seat.id is null then perform tm_error('Bu yer artıq tutulub. Yeni iştirakçı kimi qoşulun.'); end if;
  else
    insert into trip_members (trip_id, user_id, name, avatar_url)
    values (t.id, auth.uid(), coalesce(nullif(trim(me.first_name || ' ' || me.last_name), ''), split_part(me.email, '@', 1)), me.avatar_url)
    returning * into seat;
  end if;
  insert into activity (trip_id, kind, actor, data) values (t.id, 'member_joined', seat.id, jsonb_build_object('memberId', seat.id));
  for u in select user_id from trip_members where trip_id = t.id and status = 'active' and user_id is not null loop
    perform tm_notify(u, t.id, 'member_joined', seat.name || ' «' || t.name || '» səfərinə qoşuldu.', '/app/sefer/' || t.id || '/istirakcilar');
  end loop;
  return t.id;
end $$;

create or replace function public.add_member(p_trip uuid, p_name text, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare t trips; me trip_members; m uuid; invited uuid;
begin
  select * into t from trips where id = p_trip;
  select * into me from trip_members where id = my_member(p_trip);
  if me.id is null or me.role <> 'admin' then perform tm_error('İştirakçını yalnız admin əlavə edə bilər.'); end if;
  if t.archived then perform tm_error('Səfər arxivdədir. Dəyişiklik üçün əvvəlcə arxivdən çıxarın.'); end if;
  if exists (select 1 from trip_members where trip_id = p_trip and status = 'active' and lower(name) = lower(trim(p_name))) then
    perform tm_error('Bu adda iştirakçı artıq var.');
  end if;
  if (select count(*) from trip_members where trip_id = p_trip and status = 'active') >= 30 then
    perform tm_error('Bir səfərdə ən çox 30 iştirakçı ola bilər.');
  end if;
  insert into trip_members (trip_id, name) values (p_trip, trim(p_name)) returning id into m;
  insert into activity (trip_id, kind, actor, data) values (p_trip, 'member_added', me.id, jsonb_build_object('memberId', m));
  if coalesce(trim(p_email), '') <> '' then
    select id into invited from profiles where lower(email) = lower(trim(p_email));
    if invited is not null then
      insert into notifications (user_id, trip_id, kind, text, link)
      values (invited, p_trip, 'trip_invite', me.name || ' sizi «' || t.name || '» səfərinə dəvət etdi.', '/qosul/' || t.invite_code);
    end if;
  end if;
end $$;

create or replace function public.remove_member(p_trip uuid, p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t trips; me trip_members; m trip_members;
begin
  select * into t from trips where id = p_trip;
  select * into me from trip_members where id = my_member(p_trip);
  if me.id is null or me.role <> 'admin' then perform tm_error('İştirakçını yalnız admin çıxara bilər.'); end if;
  if t.archived then perform tm_error('Səfər arxivdədir. Dəyişiklik üçün əvvəlcə arxivdən çıxarın.'); end if;
  select * into m from trip_members where id = p_member and trip_id = p_trip and status = 'active' for update;
  if m.id is null then perform tm_error('İştirakçı tapılmadı.'); end if;
  if m.id = me.id or m.user_id = t.created_by then perform tm_error('Səfərin yaradıcısını çıxarmaq olmaz.'); end if;
  if member_outstanding(m.id) <> 0 then perform tm_error(m.name || ' hələ hesablaşmayıb. Əvvəlcə borclar bağlanmalıdır.'); end if;
  if exists (select 1 from payments where status = 'pending' and (from_member = m.id or to_member = m.id)) then
    perform tm_error(m.name || ' üçün təsdiq gözləyən ödəniş var.');
  end if;
  update trip_members set status = 'removed' where id = m.id;
  insert into activity (trip_id, kind, actor, data) values (p_trip, 'member_removed', me.id, jsonb_build_object('memberId', m.id));
end $$;

-- ---------------------------------------------------------------------------
-- Expenses. The client computes the split (equal / custom / percent); the
-- server re-checks that shares are non-negative, belong to the trip and add
-- up to exactly the amount.
-- ---------------------------------------------------------------------------

create or replace function public.save_expense(
  p_trip uuid, p_expense uuid, p_title text, p_amount bigint, p_category text, p_paid_by uuid,
  p_method text, p_shares jsonb, p_percents jsonb, p_date date, p_note text, p_receipt text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare t trips; me trip_members; old expenses; eid uuid; k text; v bigint; total bigint := 0; u uuid;
        allowed uuid[]; payer_name text; verb text;
begin
  select * into t from trips where id = p_trip;
  select * into me from trip_members where id = my_member(p_trip);
  if t.id is null or me.id is null then perform tm_error('Bu səfərə girişiniz yoxdur.'); end if;
  if t.archived then perform tm_error('Səfər arxivdədir. Dəyişiklik üçün əvvəlcə arxivdən çıxarın.'); end if;
  if p_amount is null or p_amount <= 0 then perform tm_error('Məbləğ sıfırdan böyük olmalıdır.'); end if;
  if p_title is null or trim(p_title) = '' then perform tm_error('Xərcin adını yazın.'); end if;

  select array_agg(id) into allowed from trip_members where trip_id = p_trip and status = 'active';
  if p_expense is not null then
    select * into old from expenses where id = p_expense and trip_id = p_trip for update;
    if old.id is null then perform tm_error('Xərc tapılmadı.'); end if;
    if me.role <> 'admin' and old.created_by <> me.id then perform tm_error('Yalnız öz yazdığınız xərcləri dəyişə bilərsiniz.'); end if;
    allowed := allowed || old.paid_by || array(select member_id from expense_shares where expense_id = old.id);
  end if;
  if not p_paid_by = any (allowed) then perform tm_error('Ödəyən şəxs bu səfərin iştirakçısı deyil.'); end if;

  for k, v in select key, value::bigint from jsonb_each_text(p_shares) loop
    if v < 0 then perform tm_error('Məbləğlər mənfi ola bilməz.'); end if;
    if not k::uuid = any (allowed) then perform tm_error('Seçilən iştirakçılardan biri bu səfərdə deyil.'); end if;
    total := total + v;
  end loop;
  if total <> p_amount then perform tm_error('Payların cəmi xərcin məbləğinə bərabər olmalıdır.'); end if;
  if p_method = 'percent' and (select coalesce(sum(value::bigint), 0) from jsonb_each_text(p_percents)) <> 10000 then
    perform tm_error('Faizlərin cəmi 100% olmalıdır.');
  end if;

  if p_expense is null then
    insert into expenses (trip_id, title, amount, category, paid_by, method, percents, date, note, receipt_url, created_by)
    values (p_trip, trim(p_title), p_amount, p_category, p_paid_by, p_method, p_percents, p_date, nullif(trim(p_note), ''), p_receipt, me.id)
    returning id into eid;
    verb := 'expense_added';
  else
    -- users affected by the old version also hear about the change
    for u in select tm.user_id from expense_shares s join trip_members tm on tm.id = s.member_id where s.expense_id = p_expense loop
      perform tm_notify(u, p_trip, 'balance_updated', me.name || ' «' || trim(p_title) || '» xərcini dəyişdi — balansınız yeniləndi.', '/app/sefer/' || p_trip || '/xercler/' || p_expense);
    end loop;
    update expenses set title = trim(p_title), amount = p_amount, category = p_category, paid_by = p_paid_by, method = p_method,
      percents = p_percents, date = p_date, note = nullif(trim(p_note), ''), receipt_url = p_receipt, updated_at = now()
    where id = p_expense;
    delete from expense_shares where expense_id = p_expense;
    eid := p_expense;
    verb := 'expense_updated';
  end if;
  insert into expense_shares (expense_id, member_id, amount)
  select eid, key::uuid, value::bigint from jsonb_each_text(p_shares) where value::bigint > 0;

  insert into activity (trip_id, kind, actor, data)
  values (p_trip, verb, me.id, jsonb_build_object('title', trim(p_title), 'amount', p_amount, 'expenseId', eid, 'category', p_category));
  if verb = 'expense_added' then
    for u in select distinct tm.user_id from trip_members tm
             where tm.id = p_paid_by or tm.id in (select member_id from expense_shares where expense_id = eid) loop
      perform tm_notify(u, p_trip, 'expense_added', me.name || ' «' || trim(p_title) || '» xərcini əlavə etdi — ' || fmt_money(p_amount, t.currency) || '.', '/app/sefer/' || p_trip || '/xercler/' || eid);
    end loop;
  end if;
  return eid;
end $$;

create or replace function public.delete_expense(p_expense uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e expenses; me trip_members; u uuid;
begin
  select * into e from expenses where id = p_expense for update;
  if e.id is null then perform tm_error('Xərc tapılmadı.'); end if;
  select * into me from trip_members where id = my_member(e.trip_id);
  if me.id is null then perform tm_error('Bu səfərə girişiniz yoxdur.'); end if;
  if (select archived from trips where id = e.trip_id) then perform tm_error('Səfər arxivdədir. Dəyişiklik üçün əvvəlcə arxivdən çıxarın.'); end if;
  if me.role <> 'admin' and e.created_by <> me.id then perform tm_error('Yalnız öz yazdığınız xərcləri silə bilərsiniz.'); end if;
  for u in select distinct tm.user_id from trip_members tm
           where tm.id = e.paid_by or tm.id in (select member_id from expense_shares where expense_id = e.id) loop
    perform tm_notify(u, e.trip_id, 'balance_updated', me.name || ' «' || e.title || '» xərcini sildi — balansınız yeniləndi.', '/app/sefer/' || e.trip_id || '/hesablasma');
  end loop;
  delete from expenses where id = e.id;
  insert into activity (trip_id, kind, actor, data)
  values (e.trip_id, 'expense_deleted', me.id, jsonb_build_object('title', e.title, 'amount', e.amount, 'category', e.category));
end $$;

-- ---------------------------------------------------------------------------
-- Payments — two-sided confirmation
-- ---------------------------------------------------------------------------

create or replace function public.mark_payment_sent(p_trip uuid, p_from uuid, p_to uuid, p_amount bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare t trips; me trip_members; debtor trip_members; receiver trip_members; owes bigint; due bigint; pid uuid; u uuid;
begin
  select * into t from trips where id = p_trip;
  select * into me from trip_members where id = my_member(p_trip);
  if me.id is null then perform tm_error('Bu səfərə girişiniz yoxdur.'); end if;
  if t.archived then perform tm_error('Səfər arxivdədir. Dəyişiklik üçün əvvəlcə arxivdən çıxarın.'); end if;
  -- lock both seats so concurrent reports cannot exceed the debt
  select * into debtor from trip_members where id = p_from and trip_id = p_trip for update;
  select * into receiver from trip_members where id = p_to and trip_id = p_trip for update;
  if debtor.id is null or receiver.id is null or debtor.id = receiver.id then perform tm_error('İştirakçı tapılmadı.'); end if;
  if not (debtor.id = me.id or (debtor.user_id is null and me.role = 'admin')) then
    perform tm_error('Ödənişi yalnız borclu özü qeyd edə bilər.');
  end if;
  if p_amount is null or p_amount <= 0 then perform tm_error('Məbləğ sıfırdan böyük olmalıdır.'); end if;
  owes := -member_outstanding(debtor.id) - coalesce((select sum(amount) from payments where from_member = debtor.id and status = 'pending'), 0);
  due  :=  member_outstanding(receiver.id) - coalesce((select sum(amount) from payments where to_member = receiver.id and status = 'pending'), 0);
  if least(owes, due) <= 0 then perform tm_error('Bu istiqamətdə açıq borc yoxdur və ya hamısı təsdiq gözləyir.'); end if;
  if p_amount > least(owes, due) then perform tm_error('Ən çox ' || fmt_money(least(owes, due), t.currency) || ' qeyd edə bilərsiniz.'); end if;
  insert into payments (trip_id, from_member, to_member, amount, created_by) values (p_trip, debtor.id, receiver.id, p_amount, me.id) returning id into pid;
  insert into activity (trip_id, kind, actor, data)
  values (p_trip, 'payment_sent', me.id, jsonb_build_object('from', debtor.id, 'to', receiver.id, 'amount', p_amount));
  if receiver.user_id is not null then
    perform tm_notify(receiver.user_id, p_trip, 'payment_sent', debtor.name || ' sizə ' || fmt_money(p_amount, t.currency) || ' göndərdiyini qeyd etdi. Təsdiq gözləyir.', '/app/sefer/' || p_trip || '/hesablasma');
  else
    for u in select user_id from trip_members where trip_id = p_trip and role = 'admin' and status = 'active' loop
      perform tm_notify(u, p_trip, 'payment_sent', debtor.name || ' ' || receiver.name || ' üçün ' || fmt_money(p_amount, t.currency) || ' göndərdiyini qeyd etdi. Təsdiq gözləyir.', '/app/sefer/' || p_trip || '/hesablasma');
    end loop;
  end if;
  return pid;
end $$;

create or replace function public.resolve_payment(p_payment uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare p payments; me trip_members; debtor trip_members; receiver trip_members; creator trip_members; t trips; notify_user uuid;
begin
  select * into p from payments where id = p_payment for update;   -- serialises double clicks
  if p.id is null then perform tm_error('Ödəniş tapılmadı.'); end if;
  select * into t from trips where id = p.trip_id;
  select * into me from trip_members where id = my_member(p.trip_id);
  if me.id is null then perform tm_error('Bu səfərə girişiniz yoxdur.'); end if;
  if t.archived then perform tm_error('Səfər arxivdədir. Dəyişiklik üçün əvvəlcə arxivdən çıxarın.'); end if;
  if p.status <> 'pending' then
    perform tm_error(case when p.status = 'confirmed' then 'Bu ödəniş artıq təsdiqlənib.' else 'Bu ödəniş artıq bağlanıb.' end);
  end if;
  select * into debtor from trip_members where id = p.from_member;
  select * into receiver from trip_members where id = p.to_member;
  select * into creator from trip_members where id = p.created_by;
  if p_action = 'cancel' then
    if not (p.created_by = me.id or p.from_member = me.id) then perform tm_error('Ödənişi yalnız onu qeyd edən ləğv edə bilər.'); end if;
  elsif p_action in ('confirm', 'reject') then
    if not (receiver.id = me.id or (receiver.user_id is null and me.role = 'admin')) then
      perform tm_error('Ödənişi yalnız pulu alan şəxs təsdiqləyə bilər.');
    end if;
  else
    perform tm_error('Naməlum əməliyyat.');
  end if;
  update payments set status = case p_action when 'confirm' then 'confirmed' when 'reject' then 'rejected' else 'cancelled' end,
    resolved_by = me.id, resolved_at = now() where id = p.id;
  insert into activity (trip_id, kind, actor, data)
  values (p.trip_id, case p_action when 'confirm' then 'payment_confirmed' when 'reject' then 'payment_rejected' else 'payment_cancelled' end,
          me.id, jsonb_build_object('from', p.from_member, 'to', p.to_member, 'amount', p.amount));
  notify_user := coalesce(debtor.user_id, creator.user_id);
  if p_action = 'confirm' then
    perform tm_notify(notify_user, p.trip_id, 'payment_confirmed', receiver.name || ' ' || fmt_money(p.amount, t.currency) || ' ödənişinizi aldığını təsdiqlədi.', '/app/sefer/' || p.trip_id || '/hesablasma');
  elsif p_action = 'reject' then
    perform tm_notify(notify_user, p.trip_id, 'payment_rejected', receiver.name || ' ' || fmt_money(p.amount, t.currency) || ' ödənişin çatmadığını bildirdi. Borc dəyişmədi.', '/app/sefer/' || p.trip_id || '/hesablasma');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Account
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then perform tm_error('Sessiya bitib. Yenidən daxil olun.'); end if;
  -- Seats stay (as name-only seats) so the trip's financial history is preserved.
  update public.trip_members set user_id = null where user_id = auth.uid();
  update public.trips set created_by = null where created_by = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

-- Functions are callable by signed-in users only.
do $$
declare f text;
begin
  foreach f in array array[
    'create_trip(text,text,date,date,text,bigint,text,text[])',
    'update_trip(uuid,text,text,date,date,text,bigint,text)',
    'set_trip_archived(uuid,boolean)', 'preview_invite(text)', 'join_trip(text,uuid)',
    'add_member(uuid,text,text)', 'remove_member(uuid,uuid)',
    'save_expense(uuid,uuid,text,bigint,text,uuid,text,jsonb,jsonb,date,text,text)',
    'delete_expense(uuid)', 'mark_payment_sent(uuid,uuid,uuid,bigint)', 'resolve_payment(uuid,text)',
    'delete_my_account()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['tm_notify(uuid,uuid,text,text,text)', 'member_outstanding(uuid)', 'tm_new_invite_code()', 'tm_error(text)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime + Storage (only on Supabase, skipped elsewhere)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.expenses, public.payments, public.trip_members,
        public.activity, public.notifications, public.trips;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
    execute $p$drop policy if exists "tripmate upload own folder" on storage.objects$p$;
    execute $p$create policy "tripmate upload own folder" on storage.objects for insert to authenticated
      with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$drop policy if exists "tripmate read media" on storage.objects$p$;
    execute $p$create policy "tripmate read media" on storage.objects for select using (bucket_id = 'media')$p$;
  end if;
end $$;
