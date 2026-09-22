# Turning on the ladder

The ladder is the board of teams in Pokémon Rip and Go: other people post
theirs, you fight them, and everybody keeps a record. It is the only part of
any game on this site that needs something outside the browser.

Until you do this, the game works exactly as it does now. The LADDER entry in
the menu explains what is missing instead of failing at a blank screen, and
nothing else changes — team codes and pack seeds are entirely offline and do
not need any of this.

> **If you have already done REVIEWS-SETUP.md, you are most of the way there.**
> The ladder uses the same Supabase project and the same accounts. Skip to
> step 2.

---

## 1. Make the Supabase project

Follow steps 1 and 2 of [REVIEWS-SETUP.md](REVIEWS-SETUP.md) — make the free
project, then paste the **Project URL** and the **anon public** key into
`supabase-config.js`. That file is the only place either value goes.

Both of those are meant to be public. The anon key is designed to sit in a web
page. What stops people writing whatever they like is the rules in step 2, not
the secrecy of the key. Never put the `service_role` key anywhere in this
repository.

## 2. Make the table

In the Supabase dashboard: **SQL Editor → New query**. Paste all of this in and
press **Run**.

```sql
-- One row per person. The team travels as a code, which the game validates
-- before it will draw it, so nothing here can describe a creature that does
-- not exist or a moveset it could never learn.
create table if not exists public.ladder (
  user_id    uuid primary key references auth.users on delete cascade,
  username   text not null check (length(username) between 1 and 24),
  code       text not null check (length(code) between 4 and 40),
  badges     int  not null default 0 check (badges between 0 and 3),
  wins       int  not null default 0 check (wins >= 0),
  losses     int  not null default 0 check (losses >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ladder enable row level security;

-- Anyone may read the board. That is the point of a board.
drop policy if exists "ladder is public" on public.ladder;
create policy "ladder is public"
  on public.ladder for select
  using (true);

-- You may only ever write your own row.
drop policy if exists "post your own team" on public.ladder;
create policy "post your own team"
  on public.ladder for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update your own team" on public.ladder;
create policy "update your own team"
  on public.ladder for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "remove your own team" on public.ladder;
create policy "remove your own team"
  on public.ladder for delete to authenticated
  using (auth.uid() = user_id);

-- Records are self-reported, because a static site has no referee. This does
-- not make that honest — it makes dishonesty tedious. A record cannot go
-- backwards and cannot move by more than one at a time, so inventing a
-- hundred wins means a hundred round trips rather than one edit.
create or replace function public.ladder_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.wins < old.wins or new.losses < old.losses then
    raise exception 'a record does not go down';
  end if;
  if new.wins > old.wins + 1 or new.losses > old.losses + 1 then
    raise exception 'one result at a time';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ladder_guard on public.ladder;
create trigger ladder_guard
  before update on public.ladder
  for each row execute function public.ladder_guard();
```

## 3. Check it

1. Open the hub and **sign in**. The game has no password box and never will —
   it only reads the session the main site already made.
2. Open Pokémon Rip and Go, press **TAB**, choose **LADDER**.
3. Press **RIGHT** to post your team. Your name should appear on the board.

If it says *"The board is there, but you are not signed in"*, you are signed
out — sign in on the hub and come back. If it says *"No ladder is switched on
for this site yet"*, `supabase-config.js` is still empty.

---

## What this is, and what it is not

**It is a place to find teams worth fighting.** Somebody posts six, you fight
them, and the board remembers who beat what.

**It is not a competitive rank, and it cannot be.** Results are reported by the
player's own browser. There is no server of yours refereeing the match, and the
key in the page is public by design. The trigger above stops a record going
backwards or jumping, which is as far as a static site can honestly go. The
board says so on its own face, in the game.

The part that *is* trustworthy is the team. It travels as a code the game
validates before drawing it, so a posted team is always a team this game could
actually have.

## What you are storing

One row per player: their username, their team code, three counters and a
timestamp. No email addresses — those live in Supabase's own `auth.users`,
which the anon key cannot read.

Anyone can delete their own row from the game. To remove somebody else's, use
**Table Editor → ladder** in the dashboard.
