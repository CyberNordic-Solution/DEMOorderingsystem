# 餐厅点餐管理系统

一个基于 Next.js 和 Supabase 的现代化餐厅点餐管理系统，支持餐桌管理、菜单管理、订单处理和支付记录。

## 🚀 功能特性

### 📱 用户界面

- **响应式设计**：支持桌面、平板和手机（针对手机做了专门优化）
- **现代化UI**：使用 Tailwind CSS 构建的美观界面
- **实时更新**：数据实时同步，无需手动刷新

### 🍽️ 核心功能

- **餐桌管理**：动态设置餐桌数量，自动同步
- **菜单管理**：分类管理，菜品上下架，批量操作
- **订单处理**：创建订单，加菜，灵活买单
- **支付记录**：完整的支付历史记录

### 📱 移动端优化（2025-09 更新）

- 加菜/点菜弹窗：
  - 小屏改为上下布局（分类/列表/已选按需折叠）
  - 分类与“已选择的菜品”支持展开/收起按钮，默认展开“已选”
  - 长菜名自动截断并保留完整 title，按钮不再被挤出
  - 底部操作区域粘底，触控目标≥44px
- 桌台页：
  - 小屏单列网格，卡片触控区更大、按钮自动换行
- 订单详情页：
  - 标题/金额自适应字号，操作条在手机端粘底

### 💳 支付系统

- **全买单**：一次性支付整个订单
- **选择买单**：选择特定菜品进行支付
- **批量付款**：多个订单同时处理
- **支付记录**：详细的支付历史追踪

### 🔧 管理功能

- **菜单设置**：分类管理，菜品管理，价格调整
- **餐桌设置**：动态调整餐桌数量
- **状态指示**：红绿灯显示菜品上下架状态

## 🛠️ 技术栈

- **前端**：Next.js 15.5.2, React, TypeScript
- **样式**：Tailwind CSS
- **后端**：Supabase (PostgreSQL)
- **认证**：Supabase Auth
- **部署**：Vercel

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd orderingsystem
```

### 2. 安装依赖

```bash
npm install
# 或
yarn install
```

### 3. 环境配置

创建 `.env.local` 文件：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. 启动开发服务器

```bash
npm run dev
# 或
yarn dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

> 提示：移动端测试建议使用 Chrome DevTools 的设备模拟或真机访问，iOS Safari 已启用惯性滚动与安全区（safe-area）适配。

## 📊 数据库设置

### 环境变量

在 Vercel 项目设置或本地 `.env.local` 中配置：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 数据库架构

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

### 添加完成时间字段

```sql
-- 为orders表添加completed_at字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
```

### 行级安全策略 (RLS)

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

## 📱 使用指南

### 1. 登录系统

- 首次使用需要注册账号
- 登录后进入主界面

### 2. 设置餐桌

- 进入"设置"页面
- 调整餐桌数量
- 点击"保存并同步桌台"

### 3. 管理菜单

- 进入"设置" → "菜单设置"
- 创建分类和菜品
- 设置价格和状态

### 4. 处理订单

- 在"桌台"页面查看所有餐桌
- 点击"+新增订单"创建订单
- 选择菜品和数量
- 支持加菜功能

### 5. 处理付款

- **全买单**：一次性支付整个订单
- **选择买单**：选择特定菜品支付
- **批量付款**：多个订单同时处理

### 6. 查看记录

- 进入"支付记录"查看历史
- 支持按时间排序
- 显示详细的订单信息

## 🚀 部署

### Vercel 部署

1. 连接 GitHub 仓库到 Vercel
2. 配置环境变量
3. 自动部署

### 环境变量配置

在 Vercel 项目设置中配置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🔧 开发

### 项目结构

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

### 脚本命令

```bash
npm run dev      # 开发服务器
npm run build    # 构建生产版本
npm run start    # 启动生产服务器
npm run lint     # 代码检查
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📞 支持

如有问题，请提交 Issue 或联系开发团队。
