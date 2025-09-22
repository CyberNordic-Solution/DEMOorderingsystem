# Restaurant Ordering Management System

A modern ordering system built with Next.js and Supabase. It supports table management, menu management, order processing and payment history.

## 🚀 Features

### 📱 UI

- **Responsive**: Desktop / Tablet / Mobile
- **Modern UI**: Tailwind CSS based components
- **Realtime**: Supabase realtime data sync

### 🍽️ Core

- **Tables**: Dynamic table count with auto sync
- **Menu**: Category management, item on/off, bulk actions
- **Orders**: Create order, add items, flexible checkout
- **History**: Complete payment history

### 💳 Payments

- **Full pay**: Pay all items in an order
- **Partial pay**: Pay selected items
- **Bulk pay**: Pay multiple orders at once
- **Audit**: Detailed payment records

### 🔧 Admin

- **Menu settings**: Manage categories/items, adjust prices
- **Table settings**: Adjust number of tables
- **Status lights**: Up/Down indicator for items

## 🛠️ Tech Stack

- **Frontend**: Next.js 15.5.2, React, TypeScript
- **Styles**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Deploy**: Vercel

## 🚀 Quick Start

### 1. Clone

```bash
git clone <repository-url>
cd orderingsystem
```

### 2. Install

```bash
npm install
# 或
yarn install
```

### 3. Environment

创建 `.env.local` 文件：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Dev Server

```bash
npm run dev
# 或
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

## 📊 Database

### Env Vars

在 Vercel 项目设置或本地 `.env.local` 中配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Schema

```sql
-- 应用设置
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_tables INT NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 餐桌
CREATE TABLE IF NOT EXISTS tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_no INT UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 菜单分类
CREATE TABLE IF NOT EXISTS menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 菜品
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id TEXT UNIQUE, -- 自定义菜品ID
  name TEXT NOT NULL,
  category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
  price INT NOT NULL, -- 以分为单位
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, name)
);

-- 订单
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  note TEXT, -- 订单备注
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ -- 完成时间
);

-- 订单项目
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL, -- 单价（分）
  price INT NOT NULL, -- 总价（分）
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户资料（用于认证）
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  role TEXT DEFAULT 'staff',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tables_index_no ON tables(index_no);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_is_paid ON order_items(is_paid);
```

### Extra Columns

```sql
-- 为orders表添加completed_at字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

### Row Level Security (RLS)

```sql
-- 启用RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 基本策略（开发环境）
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_write" ON app_settings FOR ALL USING (true);

CREATE POLICY "tables_read" ON tables FOR SELECT USING (true);
CREATE POLICY "tables_write" ON tables FOR ALL USING (true);

CREATE POLICY "menu_categories_read" ON menu_categories FOR SELECT USING (true);
CREATE POLICY "menu_categories_write" ON menu_categories FOR ALL USING (true);

CREATE POLICY "menu_items_read" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_items_write" ON menu_items FOR ALL USING (true);

CREATE POLICY "orders_read" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_write" ON orders FOR ALL USING (true);

CREATE POLICY "order_items_read" ON order_items FOR SELECT USING (true);
CREATE POLICY "order_items_write" ON order_items FOR ALL USING (true);

CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_write" ON profiles FOR ALL USING (true);
```

## 📱 Usage

### 1. Login

- 首次使用需要注册账号
- 登录后进入主界面

### 2. Tables

- 进入"设置"页面
- 调整餐桌数量
- 点击"保存并同步桌台"

### 3. Menu

- 进入"设置" → "菜单设置"
- 创建分类和菜品
- 设置价格和状态

### 4. Orders

- 在"桌台"页面查看所有餐桌
- 点击"+新增订单"创建订单
- 选择菜品和数量
- 支持加菜功能

### 5. Payments

- **全买单**：一次性支付整个订单
- **选择买单**：选择特定菜品支付
- **批量付款**：多个订单同时处理

### 6. History

- 进入"支付记录"查看历史
- 支持按时间排序
- 显示详细的订单信息

## 🚀 Deployment

### Vercel

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

### Env on Vercel

在 Vercel 项目设置中配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🔧 Development

### Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 登录页面
│   ├── tables/            # 餐桌管理
│   ├── settings/          # 设置页面
│   ├── history/           # 支付记录
│   └── orders/            # 订单详情
├── components/            # 可复用组件
├── lib/                   # 工具库
└── types/                 # TypeScript 类型定义
```

### Scripts

```bash
npm run dev      # 开发服务器
npm run build    # 构建生产版本
npm run start    # 启动生产服务器
npm run lint     # 代码检查
```

## 🤝 Contribute

欢迎提交 Issue 和 Pull Request！

## 📄 License

MIT License

## 📞 Support

如有问题，请提交 Issue 或联系开发团队。
