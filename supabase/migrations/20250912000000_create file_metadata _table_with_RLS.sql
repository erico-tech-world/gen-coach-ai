-- Migration: Create file_metadata table with RLS
-- Date: 2025-08-24

create table if not exists public.file_metadata (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  type text,
  size bigint,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text,
  created_at timestamptz not null default now()
);

alter table public.file_metadata enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'file_metadata' and policyname = 'Users can manage their own files'
  ) then
    create policy "Users can manage their own files" on public.file_metadata
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end$$;

create index if not exists idx_file_metadata_user_id on public.file_metadata(user_id);
create index if not exists idx_file_metadata_created_at on public.file_metadata(created_at);


