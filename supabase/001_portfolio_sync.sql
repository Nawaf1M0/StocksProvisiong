-- Run once in the Supabase SQL editor. No admin key belongs in the browser.
create table public.portfolios (
  user_id uuid not null references auth.users(id) on delete cascade,
  environment text not null check (environment in ('live', 'preview')),
  data jsonb not null check (
    jsonb_typeof(data) = 'object'
    and jsonb_typeof(data->'stocks') = 'array'
    and jsonb_array_length(data->'stocks') <= 1000
    and data->>'currency' in ('USD', 'SAR', 'EUR', 'GBP', 'AED')
    and data ? 'stocks' and data ? 'currency'
  ),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, environment)
);

alter table public.portfolios enable row level security;
create policy owner_read on public.portfolios for select to authenticated
  using ((select auth.uid()) = user_id);
create policy owner_insert on public.portfolios for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy owner_update on public.portfolios for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.portfolios from anon, authenticated;
grant select, insert, update on public.portfolios to authenticated;

-- Compare-and-swap: another device's revision can never be silently replaced
-- by this operation. Expected revision 0 means "create only if absent".
create function public.save_portfolio(
  p_environment text, p_data jsonb, p_expected_revision bigint
) returns setof public.portfolios
language plpgsql security invoker set search_path = '' as $$
declare saved public.portfolios;
begin
  if auth.uid() is null then
    raise exception 'Sign in before saving a portfolio' using errcode = '42501';
  end if;
  if p_expected_revision = 0 then
    insert into public.portfolios (user_id, environment, data)
      values (auth.uid(), p_environment, p_data)
      on conflict do nothing returning * into saved;
  else
    update public.portfolios
      set data = p_data, revision = revision + 1, updated_at = now()
      where user_id = auth.uid() and environment = p_environment
        and revision = p_expected_revision
      returning * into saved;
  end if;
  if saved.user_id is null then
    raise exception 'Portfolio changed on another device. Load the cloud version before retrying.'
      using errcode = '40001';
  end if;
  return next saved;
end;
$$;
revoke all on function public.save_portfolio(text, jsonb, bigint) from public, anon;
grant execute on function public.save_portfolio(text, jsonb, bigint) to authenticated;
