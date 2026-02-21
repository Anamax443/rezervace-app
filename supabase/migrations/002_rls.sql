-- ============================================================
-- 002_rls.sql (opravená verze)
-- Helper funkce jsou v public schématu (auth je read-only)
-- ============================================================

-- ── HELPER FUNKCE v public schématu ──────────────────────────

create or replace function public.get_user_role()
returns user_role as $$
  select role from public.profiles
  where id = auth.uid()
$$ language sql security definer stable;

create or replace function public.get_user_tenant_id()
returns uuid as $$
  select tenant_id from public.profiles
  where id = auth.uid()
$$ language sql security definer stable;

create or replace function public.is_superadmin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superadmin'
  )
$$ language sql security definer stable;

create or replace function public.is_tenant_staff(tid uuid)
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and tenant_id = tid
      and role in ('admin', 'keyuser')
      and aktivni = true
  )
$$ language sql security definer stable;

-- ── TENANTS ──────────────────────────────────────────────────
alter table public.tenants enable row level security;

create policy "superadmin_all_tenants"
  on public.tenants for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "staff_select_own_tenant"
  on public.tenants for select
  using (id = public.get_user_tenant_id());

create policy "anon_select_active_tenant"
  on public.tenants for select
  to anon
  using (aktivni = true and plan_status != 'deactivated');

-- ── PROFILES ─────────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "superadmin_all_profiles"
  on public.profiles for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "user_select_own_profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "admin_select_tenant_profiles"
  on public.profiles for select
  using (
    tenant_id = public.get_user_tenant_id()
    and public.get_user_role() = 'admin'
  );

create policy "admin_insert_keyuser"
  on public.profiles for insert
  with check (
    tenant_id = public.get_user_tenant_id()
    and public.get_user_role() = 'admin'
    and role = 'keyuser'
  );

create policy "admin_update_keyuser"
  on public.profiles for update
  using (
    tenant_id = public.get_user_tenant_id()
    and public.get_user_role() = 'admin'
    and role = 'keyuser'
  );

-- ── AKCE ─────────────────────────────────────────────────────
alter table public.akce enable row level security;

create policy "anon_select_active_akce"
  on public.akce for select
  to anon
  using (
    aktivni = true
    and exists (
      select 1 from public.tenants t
      where t.id = tenant_id
        and t.aktivni = true
        and t.plan_status != 'deactivated'
    )
  );

create policy "staff_select_own_akce"
  on public.akce for select
  using (
    tenant_id = public.get_user_tenant_id()
    and public.get_user_role() in ('admin', 'keyuser')
  );

create policy "superadmin_all_akce"
  on public.akce for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "staff_insert_akce"
  on public.akce for insert
  with check (
    tenant_id = public.get_user_tenant_id()
    and public.get_user_role() in ('admin', 'keyuser')
  );

create policy "staff_update_akce"
  on public.akce for update
  using (
    tenant_id = public.get_user_tenant_id()
    and public.get_user_role() in ('admin', 'keyuser')
  );

create policy "admin_delete_akce"
  on public.akce for delete
  using (
    (
      tenant_id = public.get_user_tenant_id()
      and public.get_user_role() = 'admin'
    )
    or public.is_superadmin()
  );

-- ── REZERVACE ────────────────────────────────────────────────
alter table public.rezervace enable row level security;

create policy "anon_insert_rezervace"
  on public.rezervace for insert
  to anon
  with check (
    exists (
      select 1 from public.akce a
      join public.tenants t on t.id = a.tenant_id
      where a.id = akce_id
        and a.aktivni = true
        and t.aktivni = true
        and t.plan_status != 'deactivated'
    )
  );

create policy "anon_select_by_token"
  on public.rezervace for select
  to anon
  using (true);

create policy "staff_select_own_rezervace"
  on public.rezervace for select
  using (
    tenant_id = public.get_user_tenant_id()
    and public.get_user_role() in ('admin', 'keyuser')
  );

create policy "staff_update_rezervace"
  on public.rezervace for update
  using (
    tenant_id = public.get_user_tenant_id()
    and public.get_user_role() in ('admin', 'keyuser')
  );

create policy "staff_insert_rezervace"
  on public.rezervace for insert
  with check (
    tenant_id = public.get_user_tenant_id()
    and public.get_user_role() in ('admin', 'keyuser')
  );

create policy "superadmin_all_rezervace"
  on public.rezervace for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ── BILLING LOG ──────────────────────────────────────────────
alter table public.billing_log enable row level security;

create policy "superadmin_all_billing"
  on public.billing_log for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

create policy "admin_select_own_billing"
  on public.billing_log for select
  using (
    tenant_id = public.get_user_tenant_id()
    and public.get_user_role() = 'admin'
  );

-- ── STORAGE RLS ──────────────────────────────────────────────
create policy "public_read_akce_obrazky"
  on storage.objects for select
  to public
  using (bucket_id = 'akce-obrazky');

create policy "staff_upload_akce_obrazky"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'akce-obrazky'
    and (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    and public.get_user_role() in ('admin', 'keyuser')
  );

create policy "staff_delete_akce_obrazky"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'akce-obrazky'
    and (storage.foldername(name))[1] = public.get_user_tenant_id()::text
    and public.get_user_role() in ('admin', 'keyuser')
  );

create policy "superadmin_all_storage"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'akce-obrazky'
    and public.is_superadmin()
  )
  with check (
    bucket_id = 'akce-obrazky'
    and public.is_superadmin()
  );

-- ============================================================
-- Hotovo! Pokračuj s 003_seed.sql
-- ============================================================