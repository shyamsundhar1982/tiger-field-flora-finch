create table if not exists vindy_user_roles (
  user_id text primary key,
  role text not null check (role in ('admin','management','board','finance','operations','engineering','qa','compliance','viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vindy_user_roles_role_idx
  on vindy_user_roles (role);
