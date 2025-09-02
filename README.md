This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment Variables

Create `.env.local` with the following variables (or use Vercel Project Settings → Environment Variables):

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Supabase Setup (DB)

Recommended tables (you can adapt later):

```sql
-- tables
create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  seats int not null default 2,
  is_occupied boolean not null default false
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price int not null,
  category text,
  is_active boolean not null default true
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables(id),
  people_count int not null default 1,
  status text not null default 'open',
  created_at timestamp with time zone not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id),
  quantity int not null default 1,
  unit_price int not null,
  is_paid boolean not null default false
);
```

Row Level Security: enable RLS on all tables and add policies as needed.

### Basic RLS example

For quick start (not production-ready), you may allow anon to read menus and modify orders:

```sql
alter table menu_items enable row level security;
create policy "menu read" on menu_items for select to anon using (true);

alter table tables enable row level security;
create policy "tables read" on tables for select to anon using (true);

alter table orders enable row level security;
create policy "orders ins/upd" on orders for insert with check (true);
create policy "orders upd" on orders for update using (true);
create policy "orders read" on orders for select using (true);

alter table order_items enable row level security;
create policy "order_items crud" on order_items for all using (true) with check (true);
```

In production, replace with proper Auth and policies.
