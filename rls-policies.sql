-- Pandit Babulal Ratanlal : rls-policies.sql
-- schema.sql ke BAAD chalayein.

-- Kya yeh login-shuda user owner hai?
create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner');
$$;

-- Har table par RLS chalu
alter table profiles    enable row level security;
alter table products    enable row level security;
alter table sales       enable row level security;
alter table expenses    enable row level security;
alter table daily_stock enable row level security;

-- Bina login wale (anon) ko kuch nahi
revoke all on all tables in schema public from anon;
revoke all on sales_with_total, stock_reconciliation from anon;

-- Owner ko poora access, aur kisi ko nahi
create policy owner_all on products    for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_all on sales       for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_all on expenses    for all to authenticated using (is_owner()) with check (is_owner());
create policy owner_all on daily_stock for all to authenticated using (is_owner()) with check (is_owner());

-- profiles: sirf apni row padh sakte hain; likhna sirf SQL Editor se
create policy own_profile_read on profiles for select to authenticated using (id = auth.uid());

-- ===== Pehla owner account (safe tareeka) =====
-- 1. Supabase > Authentication > Providers > Email: "Allow new users to sign up" BAND karein.
-- 2. Authentication > Users > "Add user" se uncle ka email + password banayein (Auto-confirm ON).
-- 3. Phir yeh chalayein (email badal dein):
-- insert into profiles (id, full_name, role)
--   select id, 'Owner', 'owner' from auth.users where email = 'OWNER_EMAIL_HERE';
