-- instagram_posts: tracks which claims have been turned into weekly IG proposals.
-- Apply to the main Supabase DB (the same project SUPABASE_URL points at).
-- Can also land as a migration PR in the hip-webapp repo.

create table if not exists public.instagram_posts (
  id               uuid primary key default gen_random_uuid(),
  claim_id         uuid not null references public.claims (id) on delete cascade,
  proposed_at      timestamptz not null default now(),
  posted_at        timestamptz,
  status           text not null default 'proposed'
                     check (status in ('proposed', 'approved', 'posted', 'skipped')),
  caption          text,
  image_path       text,
  slack_message_ts text,
  constraint instagram_posts_claim_id_key unique (claim_id)
);

create index if not exists instagram_posts_status_idx
  on public.instagram_posts (status);

-- Lock the table down. RLS gates only the PostgREST roles (anon / authenticated);
-- the service role the proposer uses bypasses RLS, so the script keeps full
-- access. With RLS enabled and NO policies, anon/authenticated are denied all
-- access (deny-by-default) — the anon key (which ships in client code) can't
-- read or write this table.
alter table public.instagram_posts enable row level security;
alter table public.instagram_posts force row level security;

-- Belt-and-suspenders: revoke the table grants PostgREST relies on, so even a
-- misconfigured policy can't expose it to the public API roles.
revoke all on public.instagram_posts from anon, authenticated;
