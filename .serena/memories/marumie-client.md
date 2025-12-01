# marumie/webapp/src/client アーキテクチャ設計思想

## 概要

このドキュメントは、`marumie/webapp/src/client/` 配下のディレクトリ構造とクライアントサイドの設計思想をまとめたものです。サーバーサイドの設計は別ドキュメント（docs/server.md）を参照してください。

## ディレクトリ構成

```
webapp/src/client/
├── components/      # Reactコンポーネント
│   ├── ui/             # 汎用UIコンポーネント
│   ├── layout/         # レイアウト関連コンポーネント
│   │   ├── header/        # ヘッダー関連
│   │   └── footer/        # フッター関連
│   ├── top-page/       # トップページ専用コンポーネント
│   │   └── features/      # トップページのフィーチャー別
│   │       ├── charts/             # グラフ関連
│   │       ├── transactions-table/ # トランザクションテーブル
│   │       ├── financial-summary/  # 財務サマリー
│   │       └── donation-summary/   # 寄付サマリー
│   ├── transactions/   # トランザクションページ関連
│   └── common/         # 共通コンポーネント
└── lib/            # クライアント用ヘルパー（※現在は存在しない）
```

## 1. "use client" + "client-only" による厳密なクライアント境界の宣言

### 設計原則

クライアントサイドで動作するコンポーネントには、必ず以下の2行を宣言する：

```typescript
"use client";
import "client-only";
```

### 目的

- **Next.js App Routerでのクライアント境界の明示**: "use client"でクライアントコンポーネントであることを宣言
- **静的型チェック**: "client-only"により、サーバー専用コードの誤インポートをビルド時に検出
- **バンドルサイズの最適化**: サーバー専用コードがクライアントバンドルに含まれないことを保証
- **セキュリティ**: サーバー専用APIキーやDB接続情報の漏洩を防ぐ

### 実装例

```typescript
// marumie/webapp/src/client/components/layout/header/HeaderClient.tsx
"use client";
import "client-only";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import OrganizationSelector from "./OrganizationSelector";
```

### 適用範囲

以下の19ファイルで"client-only"を使用：

- InteractiveなUIコンポーネント（ボタン、セレクタ、ページネーションなど）
- Next.jsのクライアント専用フック（useRouter, useSearchParams, usePathnameなど）を使用するコンポーネント
- ブラウザAPIを使用するコンポーネント
- React StateやEffectを使用するコンポーネント

## 2. フィーチャー駆動のディレクトリ構造

### 設計原則

コンポーネントは**ページ単位**と**機能単位**で階層的に配置する。

### ディレクトリの分類

| カテゴリ | ディレクトリ | 責務 | 例 |
|---------|------------|------|-----|
| **汎用UI** | `ui/` | プロジェクト全体で再利用される基本UIコンポーネント | `Button.tsx`, `MainButton.tsx`, `Selector.tsx` |
| **レイアウト** | `layout/` | ページ全体のレイアウトを構成するコンポーネント | `Header.tsx`, `Footer.tsx`, `MainColumn.tsx` |
| **ページ別** | `top-page/`, `transactions/` | 特定ページ専用のコンポーネント | `TransactionsSection.tsx`, `CsvDownloadLink.tsx` |
| **フィーチャー別** | `top-page/features/` | ページ内の複雑な機能をまとめたサブディレクトリ | `charts/`, `transactions-table/`, `financial-summary/` |
| **共通** | `common/` | 複数ページで共有されるが汎用UIではないコンポーネント | `AboutSection.tsx`, `FloatingBackButton.tsx` |

### フィーチャー別ディレクトリの例

```
top-page/features/
├── charts/                  # グラフ機能
│   ├── SankeyChart.tsx
│   ├── MonthlyChart.tsx
│   ├── DonationChart.tsx
│   ├── BalanceSheetChart.tsx
│   ├── InteractiveRect.tsx
│   └── useSankeyHelpers.ts  # カスタムフック
├── transactions-table/      # トランザクションテーブル機能
│   ├── InteractiveTransactionTable.tsx  # メインコンポーネント
│   ├── TransactionTable.tsx
│   ├── TransactionTableHeader.tsx
│   ├── TransactionTableBody.tsx
│   ├── TransactionTableRow.tsx
│   ├── TransactionTableMobileHeader.tsx
│   ├── PCPaginator.tsx
│   ├── MobilePaginator.tsx
│   └── CategoryFilter.tsx
├── financial-summary/       # 財務サマリー機能
│   ├── FinancialSummarySection.tsx
│   ├── FinancialSummaryCard.tsx
│   └── BalanceDetailCard.tsx
└── donation-summary/        # 寄付サマリー機能
    └── DonationSummaryCards.tsx
```

### 意図

- **関心の分離**: 機能ごとにコンポーネントをまとめ、コードの見通しを良くする
- **LLMにとっての明快さ**: フィーチャー単位でディレクトリが分かれているため、LLMが関連ファイルを特定しやすい
- **保守性**: 機能追加・修正時に影響範囲が明確になる
- **テスト可能性**: フィーチャー単位でテストを書きやすい

## 3. コンポーネントの粒度と責務の明確化

### 設計原則

コンポーネントは**単一責任の原則**に従い、役割を明確に分離する。

### コンポーネントの分類

#### 3-1. 汎用UIコンポーネント (`ui/`)

**責務**: プロジェクト全体で再利用される、ドメイン非依存のUIコンポーネント

**特徴**:
- ビジネスロジックを含まない
- Props経由でデータと振る舞いを受け取る
- スタイリングを含む、見た目の一貫性を保証

**実装例**:

```typescript
// ui/Button.tsx - 最も基本的なボタンコンポーネント
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  style?: React.CSSProperties;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

export default function Button({ children, onClick, className = "", ... }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center ... ${className}`}
    >
      {children}
    </button>
  );
}
```

```typescript
// ui/MainButton.tsx - Buttonを拡張した特定スタイルのボタン
export default function MainButton({ children, onClick, ... }: MainButtonProps) {
  return (
    <Button
      onClick={onClick}
      className="w-[270px] h-12 bg-white border border-[#1F2937] ..."
    >
      {children}
    </Button>
  );
}
```

**ポイント**:
- `Button.tsx`が最小単位の汎用ボタン
- `MainButton.tsx`が`Button`を拡張してプロジェクト固有のスタイルを適用
- この階層的な拡張により、スタイルの一貫性と再利用性を両立

#### 3-2. レイアウトコンポーネント (`layout/`)

**責務**: ページ全体の構造を定義する

**特徴**:
- ヘッダー、フッター、メインカラムなどのページ骨格
- 子コンポーネントをレイアウトするためのラッパー
- レスポンシブデザインの制御

**実装例**:

```typescript
// layout/header/HeaderClient.tsx
export default function HeaderClient({ organizations }: HeaderClientProps) {
  const pathname = usePathname();
  const currentSlug = pathname.startsWith("/o/") ? pathname.split("/")[2] : organizations.default;
  
  return (
    <header className="fixed top-0 left-0 right-0 z-40 ...">
      <div className="bg-white rounded-[20px] ...">
        <Link href={logoHref}>...</Link>
        <nav>...</nav>
        <OrganizationSelector organizations={organizations} initialSlug={currentSlug} />
      </div>
    </header>
  );
}
```

**ポイント**:
- Next.jsのクライアント専用フック（`usePathname`）を使用
- 組織セレクタなどのインタラクティブな子コンポーネントを配置
- レスポンシブデザイン（`lg:`, `xl:`ブレークポイント）

#### 3-3. フィーチャーコンポーネント (`top-page/features/`)

**責務**: 特定の機能を実装する、複数のサブコンポーネントから構成される複合コンポーネント

**特徴**:
- URL検索パラメータの管理
- ビジネスロジックの実装（ソート、フィルタ、ページネーション）
- サブコンポーネントの組み立て

**実装例**:

```typescript
// top-page/features/transactions-table/InteractiveTransactionTable.tsx
export default function InteractiveTransactionTable({
  slug,
  transactions,
  total,
  page,
  perPage,
  totalPages,
  selectedCategories,
}: InteractiveTransactionTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ソート処理
  const handleSort = (field: "date" | "amount") => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === field) {
      params.set("order", currentOrder === "desc" ? "asc" : "desc");
    } else {
      params.set("sort", field);
      params.set("order", "desc");
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  // ページネーション処理
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  };

  // フィルタ処理
  const handleApplyFilter = (selectedKeys: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedKeys.length > 0) {
      params.set("categories", selectedKeys.join(","));
    } else {
      params.delete("categories");
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`);
  };

  return (
    <>
      <TransactionTableMobileHeader onSortChange={handleMobileSortChange} currentSort={getCurrentSortOption()} />
      <TransactionTable
        transactions={transactions}
        allowControl={true}
        onSort={handleSort}
        currentSort={currentSort}
        currentOrder={currentOrder}
        onApplyFilter={handleApplyFilter}
        selectedCategories={selectedCategories}
      />
      <PCPaginator currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
      <MobilePaginator currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
    </>
  );
}
```

**ポイント**:
- **URL検索パラメータの集中管理**: ソート、フィルタ、ページネーションのすべてをURL検索パラメータで管理
- **Next.js App Routerの活用**: `useRouter`と`useSearchParams`で状態をURLに同期
- **サブコンポーネントの組み立て**: モバイル用とPC用のUIを使い分け
- **ビジネスロジックの実装**: ソートのトグル、フィルタの適用、ページ変更時のリセット処理

#### 3-4. ページコンポーネント (`top-page/`, `transactions/`)

**責務**: サーバーから受け取ったデータをフィーチャーコンポーネントに渡す

**特徴**:
- データの受け渡し役（Presentational Component）
- レイアウトの組み立て

**実装例**:

```typescript
// top-page/TransactionsSection.tsx
export default function TransactionsSection({
  transactionData,
  updatedAt,
  slug,
  organizationName,
}: TransactionsSectionProps) {
  return (
    <MainColumnCard id="transactions">
      <CardHeader
        icon={<Image src="/icons/icon-cashback.svg" alt="Cash move icon" width={30} height={30} />}
        organizationName={organizationName || "未登録の政治団体"}
        title="すべての出入金"
        updatedAt={updatedAt}
        subtitle="これまでにデータ連携された出入金の明細"
      />
      {transactionData ? (
        <div className="relative">
          <TransactionTable
            transactions={transactionData.transactions}
            total={transactionData.total}
            page={transactionData.page}
            perPage={transactionData.perPage}
          />
          <div className="absolute bottom-0 left-0 right-0 h-32 from-white via-white/70 to-transparent">
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <Link href={`/o/${slug}/transactions`}>
                <MainButton>もっと見る</MainButton>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-gray-500 text-center py-8">取引データが取得できませんでした</div>
      )}
    </MainColumnCard>
  );
}
```

**ポイント**:
- **データの受け渡し専念**: ビジネスロジックは持たず、Propsを子コンポーネントに渡す
- **レイアウトの構築**: カード、ヘッダー、ボタンなどのレイアウト構成要素を配置
- **条件付きレンダリング**: データの有無に応じてUIを切り替え

## 4. カスタムフックの配置

### 設計原則

フィーチャー固有のカスタムフックは、そのフィーチャーディレクトリ内に配置する。

### 実装例

```typescript
// top-page/features/charts/useSankeyHelpers.ts
// SankeyChart専用のヘルパーフック
```

### 意図

- **関心の分離**: カスタムフックをフィーチャーと同じディレクトリに配置し、関連性を明確にする
- **再利用性**: 複数のコンポーネントで共有される場合は`client/lib/`に移動することも可能（現在は未実装）

## 5. クライアント/サーバーの責務分離

### 設計原則

- **クライアントコンポーネント**: インタラクション、状態管理、ブラウザAPIの使用に特化
- **サーバーコンポーネント**: データ取得、初期レンダリングに特化

### クライアントコンポーネントが持つべきもの

1. **状態管理**: React State, Context
2. **イベントハンドラ**: onClick, onChangeなど
3. **ブラウザAPI**: useRouter, useSearchParams, localStorage, window
4. **インタラクティブUI**: ボタン、フォーム、モーダル、ドロップダウン

### クライアントコンポーネントが持たないもの

1. **データ取得**: サーバーコンポーネントまたはServer Actionsで実施
2. **DB接続**: 必ずサーバーサイド（loaders, repositories）で実施
3. **APIキー**: サーバー環境変数のみで管理

### データフロー

```
1. App Router (page.tsx) - サーバーコンポーネント
   ↓ loaderでデータ取得
2. Loader (server/loaders/) - サーバー専用
   ↓ データを返す
3. Page Component (top-page/*Section.tsx) - クライアントコンポーネント
   ↓ Propsでデータを渡す
4. Feature Component (features/*/*.tsx) - クライアントコンポーネント
   ↓ インタラクション、状態管理
5. UI Component (ui/*.tsx) - クライアントコンポーネント
   ↓ 表示のみ
```

## 6. LLM開発に最適化された設計

### LLMにとっての明快さを実現する工夫

#### 6-1. 厳格なディレクトリ構造

- **フィーチャー駆動**: 機能ごとにディレクトリを分けることで、LLMが関連ファイルを特定しやすい
- **階層的な命名**: `top-page/features/transactions-table/`のように、階層が明確

#### 6-2. 明示的な境界宣言

- **"use client" + "client-only"**: クライアント/サーバーの境界を静的にチェック
- **import "server-only"**: サーバー専用コードの誤インポートを防ぐ

#### 6-3. 一貫性のあるパターン

- **Buttonの階層的拡張**: `Button.tsx` → `MainButton.tsx`のように、拡張パターンが統一
- **コンポーネント命名**: `InteractiveTransactionTable`, `PCPaginator`, `MobilePaginator`など、役割が名前から明確

#### 6-4. 設計ルールの厳格な適用

人間が手で書くと「こんなシンプルな処理にも細かく分けるの面倒だな」と思いそうな部分も、LLMにとっては苦ではないため、しっかりディレクトリ構造とコンポーネント分割を行うことで見通しが悪化しにくい。

## まとめ

このアーキテクチャは、以下の設計原則に基づいています：

1. **"use client" + "client-only"による厳密なクライアント境界の宣言**
2. **フィーチャー駆動のディレクトリ構造**
3. **単一責任の原則に基づくコンポーネント分割**
4. **カスタムフックのフィーチャー内配置**
5. **クライアント/サーバーの責務分離**
6. **LLM開発に最適化された設計**

これらの設計思想に従うことで、LLMにとっても人間にとっても明快で、拡張性が高く、保守しやすいクライアントサイドコードベースを維持できます。
