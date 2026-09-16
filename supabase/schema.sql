-- ============================================================
-- Create Your Character — Supabase schema
-- Run this whole file in the Supabase SQL editor (Dashboard → SQL → New query).
-- Also enable: Authentication → Sign In / Providers → "Anonymous sign-ins"
-- (students join a class without an e-mail).
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------ tables

create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  code        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null check (role in ('teacher', 'student')),
  display_name  text not null,
  class_id      uuid references public.classes(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.characters (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  class_id    uuid references public.classes(id) on delete set null,
  kind        text not null check (kind in ('monster', 'dragon', 'princess')),
  name        text not null,
  parts       jsonb not null default '{}'::jsonb,
  colors      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists characters_owner_idx on public.characters(owner_id);
create index if not exists characters_class_idx on public.characters(class_id);
create index if not exists profiles_class_idx on public.profiles(class_id);

-- ------------------------------------------------------------ helpers
-- Security-definer helpers avoid recursive RLS checks.

create or replace function public.my_class_id()
returns uuid language sql stable security definer set search_path = public as $$
  select class_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_class_teacher(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes where id = cid and teacher_id = auth.uid());
$$;

-- Creates the profile row automatically when a user signs up / signs in anonymously.
-- Teachers: metadata { role: 'teacher', display_name }.
-- Students: anonymous sign-in with metadata { role: 'student', display_name, class_code }.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_class uuid;
  v_role text;
begin
  if new.raw_user_meta_data ? 'class_code' then
    select id into v_class from public.classes where code = upper(new.raw_user_meta_data->>'class_code');
  end if;
  v_role := coalesce(new.raw_user_meta_data->>'role', case when new.is_anonymous then 'student' else 'teacher' end);
  insert into public.profiles (id, role, display_name, class_id)
  values (new.id, v_role, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), 'Friend'), v_class)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists characters_touch on public.characters;
create trigger characters_touch before update on public.characters
  for each row execute procedure public.touch_updated_at();

-- ------------------------------------------------------------ RLS

alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.characters enable row level security;

-- classes: anyone can look a class up by code (needed before a student signs in);
-- only the teacher can create / edit / delete their classes.
drop policy if exists "classes are readable" on public.classes;
create policy "classes are readable" on public.classes
  for select using (true);

drop policy if exists "teachers manage own classes" on public.classes;
create policy "teachers manage own classes" on public.classes
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- profiles: you can see yourself, your classmates and (as teacher) your students.
drop policy if exists "profiles readable by class" on public.profiles;
create policy "profiles readable by class" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (class_id is not null and class_id = public.my_class_id())
    or public.is_class_teacher(class_id)
  );

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- characters: owner, classmates and the class teacher can see them;
-- only the owner (or the class teacher) can change / delete them.
drop policy if exists "characters readable by class" on public.characters;
create policy "characters readable by class" on public.characters
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (class_id is not null and class_id = public.my_class_id())
    or public.is_class_teacher(class_id)
  );

drop policy if exists "owners insert characters" on public.characters;
create policy "owners insert characters" on public.characters
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "owners or teacher update characters" on public.characters;
create policy "owners or teacher update characters" on public.characters
  for update to authenticated
  using (owner_id = auth.uid() or public.is_class_teacher(class_id))
  with check (owner_id = auth.uid() or public.is_class_teacher(class_id));

drop policy if exists "owners or teacher delete characters" on public.characters;
create policy "owners or teacher delete characters" on public.characters
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_class_teacher(class_id));
