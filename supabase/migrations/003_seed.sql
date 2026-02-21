-- ============================================================
-- 003_seed.sql
-- Testovaci data – UUID doplnena z Supabase Auth
-- superadmin@maxferit.cz  af1f34fd-6574-4b1b-ae56-62a56426ee71
-- admin@maxferit.cz       6da9101e-544f-4333-be44-68307f01ad2f
-- keyuser@maxferit.cz     e069485a-9f11-4c4a-b20d-27354a7c7411
-- ============================================================

do $$
declare
  v_superadmin_id   uuid := 'af1f34fd-6574-4b1b-ae56-62a56426ee71';
  v_admin_id        uuid := '6da9101e-544f-4333-be44-68307f01ad2f';
  v_keyuser_id      uuid := 'e069485a-9f11-4c4a-b20d-27354a7c7411';
  v_tenant_id       uuid;
  v_akce1_id        uuid;
  v_akce2_id        uuid;
  v_akce3_id        uuid;

begin

  -- TENANT
  insert into public.tenants (
    nazev, subdomain, fio_ucet,
    plan, plan_status, trial_vyuzit,
    plan_zacatek, plan_expirace,
    aktivni
  ) values (
    'Vinoteka Novak',
    'novak',
    '2801234567/2010',
    'trial',
    'trial',
    true,
    now(),
    now() + interval '30 days',
    true
  )
  returning id into v_tenant_id;

  raise notice 'Tenant ID: %', v_tenant_id;

  -- PROFILES
  insert into public.profiles (id, tenant_id, role, jmeno, first_login)
  values (v_superadmin_id, null, 'superadmin', 'Milan Trnka', false);

  insert into public.profiles (id, tenant_id, role, jmeno, first_login)
  values (v_admin_id, v_tenant_id, 'admin', 'Jana Novakova', true);

  insert into public.profiles (id, tenant_id, role, jmeno, first_login)
  values (v_keyuser_id, v_tenant_id, 'keyuser', 'Petr Dvorak', true);

  -- AKCE 1
  insert into public.akce (
    tenant_id, nazev, typ, datum,
    cas_zacatek, cas_konec,
    kapacita, ma_sezeni, cena,
    popis, aktivni, vytvoril_id
  ) values (
    v_tenant_id,
    'Burgundske degustacni vecer',
    'degustace',
    current_date + interval '22 days',
    '18:00', '21:00',
    20, true, 650,
    'Degustace burgundskych vin z roku 2021 s odbornym vykladem sommeliera.',
    true, v_keyuser_id
  )
  returning id into v_akce1_id;

  -- AKCE 2
  insert into public.akce (
    tenant_id, nazev, typ, datum,
    cas_zacatek, cas_konec,
    kapacita, ma_sezeni, cena,
    popis, aktivni, vytvoril_id
  ) values (
    v_tenant_id,
    'Prednaška: Svetova vina 2025',
    'přednáška',
    current_date + interval '29 days',
    '19:30', '21:00',
    30, true, 350,
    'Prehled nejzajimavejsich vin z letosniho rocniku.',
    true, v_keyuser_id
  )
  returning id into v_akce2_id;

  -- AKCE 3
  insert into public.akce (
    tenant_id, nazev, typ, datum,
    cas_zacatek, cas_konec,
    kapacita, ma_sezeni, cena,
    popis, aktivni, vytvoril_id
  ) values (
    v_tenant_id,
    'Jarni koncert - Quarteto Vino',
    'koncert',
    current_date + interval '43 days',
    '20:00', '22:30',
    50, false, 480,
    'Komorni jazzovy koncert v prostorach vinotéky.',
    true, v_keyuser_id
  )
  returning id into v_akce3_id;

  -- REZERVACE
  insert into public.rezervace (
    tenant_id, akce_id, vs,
    jmeno, email, pocet_mist, celkova_castka,
    stav, datum_platby
  ) values
  (v_tenant_id, v_akce1_id, nextval('vs_rezervace_seq'),
   'Martina Horakova', 'm.horakova@gmail.com', 2, 1300,
   'zaplaceno_qr', now() - interval '2 days'),
  (v_tenant_id, v_akce1_id, nextval('vs_rezervace_seq'),
   'Josef Blazek', 'blazek.j@seznam.cz', 1, 650,
   'zaplaceno_hotově', now() - interval '1 day'),
  (v_tenant_id, v_akce1_id, nextval('vs_rezervace_seq'),
   null, 'info@firma.cz', 4, 2600,
   'čeká', null),
  (v_tenant_id, v_akce1_id, nextval('vs_rezervace_seq'),
   'Eva Markova', 'eva.mark@gmail.com', 2, 1300,
   'zaplaceno_qr', now() - interval '3 hours'),
  (v_tenant_id, v_akce1_id, nextval('vs_rezervace_seq'),
   'Tomas Prochazka', 't.prochazka@gmail.com', 4, 2600,
   'zaplaceno_qr', now() - interval '5 hours'),
  (v_tenant_id, v_akce1_id, nextval('vs_rezervace_seq'),
   'Lucie Krejci', 'lucie.k@email.cz', 2, 1300,
   'zaplaceno_qr', now() - interval '1 day'),
  (v_tenant_id, v_akce1_id, nextval('vs_rezervace_seq'),
   'Pavel Novotny', 'pnovotny@yahoo.com', 2, 1300,
   'zaplaceno_qr', now() - interval '4 days'),
  (v_tenant_id, v_akce2_id, nextval('vs_rezervace_seq'),
   'Anna Svobodova', 'a.svobodova@gmail.com', 2, 700,
   'zaplaceno_qr', now() - interval '1 day'),
  (v_tenant_id, v_akce2_id, nextval('vs_rezervace_seq'),
   'Radek Fiala', 'r.fiala@seznam.cz', 1, 350,
   'čeká', null);

  -- BILLING LOG
  insert into public.billing_log (tenant_id, udalost, poznamka)
  values
  (v_tenant_id, 'tenant_vytvoreno', 'Tenant vytvoren superadminem'),
  (v_tenant_id, 'trial_aktivovan', 'Trial 30 dni spusten automaticky');

  raise notice 'Seed dokoncen. Tenant: % | Akce1: % | Akce2: % | Akce3: %',
    v_tenant_id, v_akce1_id, v_akce2_id, v_akce3_id;

end $$;