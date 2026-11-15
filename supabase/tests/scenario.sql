-- Run after harness.sql + schema.sql. Each step runs as a signed-in user.
\set ON_ERROR_STOP 1
grant select on all tables in schema public to authenticated;
grant update (first_name, last_name, avatar_url, currency, language, theme, notify, completed) on public.profiles to authenticated;
grant update (read) on public.notifications to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'maryam@x.az', '{"full_name":"Məryəm Hüseynova"}'),
 ('00000000-0000-0000-0000-00000000000b', 'ali@x.az', '{"full_name":"Əli Məmmədov"}'),
 ('00000000-0000-0000-0000-00000000000c', 'leyla@x.az', '{}');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select first_name, last_name from profiles;   -- created by trigger
select id as trip, invite_code from create_trip('İtaliya', 'Roma', '2026-06-15', '2026-06-22', 'EUR', 200000, null, array['Əli', 'Leyla']) \gset
select name, role, user_id is not null as linked from trip_members where trip_id = :'trip' order by joined_at;

-- Əli joins and claims his seat
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select count(*) as ali_sees_before from trips;  -- 0: not yet a member
select preview_invite(:'invite_code') -> 'openSeats' as seats;
select join_trip(lower(:'invite_code'), (select (s->>'id')::uuid from jsonb_array_elements(preview_invite(:'invite_code')->'openSeats') s where s->>'name' = 'Əli'));
select count(*) as ali_sees_after from trips;

select id as m from trip_members where trip_id = :'trip' and name like 'Məryəm%' \gset
select id as a from trip_members where trip_id = :'trip' and name = 'Əli' \gset
select id as l from trip_members where trip_id = :'trip' and name = 'Leyla' \gset

-- Məryəm pays 300 € split equally among three
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select save_expense(:'trip', null, 'Otel', 30000, 'stay', :'m', 'equal',
  jsonb_build_object(:'m', 10000, :'a', 10000, :'l', 10000), null, '2026-06-16', '', null) as e1 \gset
\echo 'expect error: shares do not add up'
\set ON_ERROR_STOP 0
select save_expense(:'trip', null, 'Pizza', 5000, 'food', :'m', 'custom', jsonb_build_object(:'m', 1000, :'a', 1000), null, '2026-06-16', '', null);
select save_expense(:'trip', null, 'Pizza', -5, 'food', :'m', 'equal', jsonb_build_object(:'m', -5), null, '2026-06-16', '', null);
\set ON_ERROR_STOP 1
reset role; select name, member_outstanding(id) from trip_members where trip_id = :'trip' order by joined_at; set role authenticated;

-- Əli reports 40 € of his 100 € debt; he cannot confirm it himself
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
\set ON_ERROR_STOP 0
\echo 'expect error: too much'
select mark_payment_sent(:'trip', :'a', :'m', 15000);
\echo 'expect error: not the debtor'
select mark_payment_sent(:'trip', :'l', :'m', 1000);
\echo 'expect error: no direct table writes'
update payments set status = 'confirmed';
insert into expenses (trip_id, title, amount, category, paid_by, method, date, created_by) values (:'trip', 'x', 1, 'food', :'a', 'equal', '2026-06-16', :'a');
\set ON_ERROR_STOP 1
select mark_payment_sent(:'trip', :'a', :'m', 4000) as p1 \gset
\set ON_ERROR_STOP 0
\echo 'expect error: debtor cannot confirm'
select resolve_payment(:'p1', 'confirm');
\set ON_ERROR_STOP 1

-- Məryəm sees the notification and confirms once
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select kind, text from notifications;
select resolve_payment(:'p1', 'confirm');
\set ON_ERROR_STOP 0
\echo 'expect error: already confirmed'
select resolve_payment(:'p1', 'confirm');
\set ON_ERROR_STOP 1
select status, resolved_by = :'m' as by_receiver, resolved_at is not null as dated from payments;
reset role; select name, member_outstanding(id) as outstanding from trip_members where trip_id = :'trip' order by joined_at; set role authenticated;

-- Rejection keeps the debt
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select mark_payment_sent(:'trip', :'a', :'m', 6000) as p2 \gset
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select resolve_payment(:'p2', 'reject');
reset role; select member_outstanding(:'a') as ali_still_owes; set role authenticated;  -- -6000
-- admin confirms for name-only seat Leyla's payment (Leyla has no account) — admin reports on her behalf
select mark_payment_sent(:'trip', :'l', :'m', 10000) as p3 \gset
select resolve_payment(:'p3', 'confirm');
reset role; select name, member_outstanding(id) as outstanding from trip_members where trip_id = :'trip' order by joined_at; set role authenticated;
\set ON_ERROR_STOP 0
\echo 'expect error: remove member with open balance'
select remove_member(:'trip', :'a');
\set ON_ERROR_STOP 1
select kind, actor is not null as has_actor from activity where trip_id = :'trip' order by at;
-- Leyla (separate account, not a member) sees nothing
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select count(*) as leyla_trips, (select count(*) from expenses) as leyla_expenses, (select count(*) from payments) as leyla_payments from trips;
reset role;
select fmt_money(123450, 'AZN'), fmt_money(-7000, 'EUR'), fmt_money(5, 'USD');
