create table if not exists public.kiosk_invitations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  kiosk_id uuid references public.kiosks(id) on delete cascade not null,
  email text not null,
  role text not null check (role in ('owner', 'seller')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamp with time zone not null,
  invited_by uuid references auth.users(id) not null
);

-- RLS
alter table public.kiosk_invitations enable row level security;

-- Owner can manage their kiosk's invitations
create policy "Owners can manage invitations" on public.kiosk_invitations for all using (
    public.is_kiosk_owner(kiosk_id)
);

-- Anyone can read an invitation by its token to accept it
create policy "Anyone can view pending invitations by token" on public.kiosk_invitations for select using (
    status = 'pending'
);
