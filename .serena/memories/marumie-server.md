関連ファイル
[[95%以上をLLMが実装。『みらいまる見え政治資金』を45日で完成させた、AIネイティブな開発手法についてご紹介｜Jun Ito]]
[[『みらい まる見え政治資金』を支える技術-国政政党がリリースしたOSSの技術選定と実装について｜Jun Ito]]

個人的にNext.jsでこのやりかたは結構あり
AIが意味不明なところにファイルを作成させることを抑止できる
データアクセス層をloaderで隠蔽しているのがわかりやすい
以下生成AIによるフォルダ分析

---
# webapp/src アーキテクチャ設計思想

## 概要

このドキュメントは、`webapp/src/` 配下のディレクトリ構造とアーキテクチャ設計思想をまとめたオンボーディング資料です。

## ディレクトリ構成

```
webapp/src/
├── app/           # App Router に基づくルーティング・APIエンドポイント
├── client/        # クライアントサイドコード
│   ├── components/  # Reactコンポーネント
│   └── lib/         # クライアント用ヘルパー
├── server/        # サーバーサイドコード
│   ├── actions/     # サーバーアクション("use server")
│   ├── loaders/     # データ取得処理
│   ├── usecases/    # ビジネスロジック
│   ├── repositories/  # データアクセス層
│   │   └── interfaces/  # リポジトリインターフェース
│   ├── utils/       # サーバー用ユーティリティ
│   └── lib/         # サーバー用ライブラリ(Prismaなど)
└── types/         # 型定義
```

## 1. サーバーオンリーによるサーバーとクライアントの厳密な区分け

### 設計原則

サーバー側で動作することを期待する処理には、必ず `import "server-only"` を宣言し、誤ってクライアントから参照されないようにする。

### 実装例

以下のファイルで `server-only` を使用しています：

- `webapp/src/server/lib/prisma.ts`
- `webapp/src/server/loaders/*.ts`
- `webapp/src/server/repositories/*.ts`
- `webapp/src/server/usecases/*.ts`
- `webapp/src/app/*/page.tsx` (サーバーコンポーネント)

### 具体例

```typescript
// webapp/src/server/lib/prisma.ts
import "server-only";

import { PrismaClient } from "@prisma/client";

export const prisma = /* ... */;
```

```typescript
// webapp/src/app/o/[slug]/page.tsx
import "server-only";
import type { Metadata } from "next";
import { loadPersonalTopPageData } from "@/server/loaders/load-personal-top-page-data";

export default async function OrgPage({ params }: OrgPageProps) {
  const data = await loadPersonalTopPageData({...});
  return <MainColumn>...</MainColumn>;
}
```

### 意図

- **静的型チェック**: ビルド時にクライアント側からのサーバーコードのインポートを検出
- **バンドルサイズ削減**: サーバー専用コードがクライアントバンドルに含まれない
- **セキュリティ**: DB接続情報やAPIキーなどの機密情報の漏洩を防ぐ

## 2. DIによるレポジトリ層の依存性逆転及び分離

### 設計原則

インターフェースと実装を分離し、依存性注入(DI)パターンを採用することで、テスタビリティと保守性を向上させる。

### アーキテクチャ図

```
Usecase (ビジネスロジック)
    ↓ 依存(インターフェース)
ITransactionRepository (抽象)
    ↑ 実装
PrismaTransactionRepository (具象)
```

### 実装例

#### インターフェース定義

```typescript
// webapp/src/server/repositories/interfaces/transaction-repository.interface.ts
export interface ITransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findAll(filters?: TransactionFilters): Promise<Transaction[]>;
  findWithPagination(...): Promise<PaginatedResult<Transaction>>;
  getCategoryAggregationForSankey(...): Promise<SankeyCategoryAggregationResult>;
  getMonthlyAggregation(...): Promise<MonthlyAggregation[]>;
  // ... その他のメソッド
}
```

#### 実装クラス

```typescript
// webapp/src/server/repositories/prisma-transaction.repository.ts
export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Transaction | null> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: BigInt(id) },
    });
    return transaction ? this.mapToTransaction(transaction) : null;
  }
  
  // ... その他のメソッド実装
}
```

#### Usecaseでの利用

```typescript
// webapp/src/server/usecases/get-transactions-by-slug-usecase.ts
export class GetTransactionsBySlugUsecase {
  constructor(
    private transactionRepository: ITransactionRepository,
    private politicalOrganizationRepository: IPoliticalOrganizationRepository,
  ) {}

  async execute(params: GetTransactionsBySlugParams): Promise<GetTransactionsBySlugResult> {
    const politicalOrganizations = 
      await this.politicalOrganizationRepository.findBySlugs(params.slugs);
    
    const transactionResult = 
      await this.transactionRepository.findWithPagination(filters, pagination);
    
    return { transactions, total, ... };
  }
}
```

### 意図

- **テスタビリティ**: モックリポジトリを注入してユニットテストを実施可能
- **疎結合**: ビジネスロジック層(Usecase)がデータアクセス層(Repository)の実装詳細に依存しない
- **拡張性**: 例えば、PrismaからTypeORMへの移行時に、UsecaseやLoaderの変更が不要
- **SOLID原則**: 依存性逆転の原則(Dependency Inversion Principle)に準拠

## 3. ユースケース層によるロジックの分離

### 設計原則

Usecaseクラスは、複数のRepositoryを組み合わせた複雑なビジネスロジックを実装する。

### 責務

- **複数リポジトリの組み合わせ**: TransactionRepositoryとPoliticalOrganizationRepositoryを連携させる
- **エラーハンドリング**: エラー発生時のログ出力とエラーメッセージの統一
- **データ変換**: Repositoryから取得した生データをプレゼンテーション層向けに変換
- **Repositoryアクセス**: 基本的にUsecaseはRepositoryへのアクセスを伴う（データ取得・集約）

### 実装例

```typescript
// webapp/src/server/usecases/get-transactions-by-slug-usecase.ts
export class GetTransactionsBySlugUsecase {
  constructor(
    private transactionRepository: ITransactionRepository,
    private politicalOrganizationRepository: IPoliticalOrganizationRepository,
  ) {}

  async execute(params: GetTransactionsBySlugParams): Promise<GetTransactionsBySlugResult> {
    // 1. slug から政治団体を検索（Repositoryアクセス）
    const politicalOrganizations = 
      await this.politicalOrganizationRepository.findBySlugs(params.slugs);
    
    if (politicalOrganizations.length === 0) {
      throw new Error(`Political organizations with slugs "${params.slugs.join(", ")}" not found`);
    }

    // 2. 組織IDを抽出してフィルタを構築（ビジネスロジック）
    const organizationIds = politicalOrganizations.map((org) => org.id);
    const filters: TransactionFilters = {
      political_organization_ids: organizationIds,
      financial_year: params.financialYear,
      // ... その他のフィルタ
    };

    // 3. トランザクションを取得（Repositoryアクセス）
    const [transactionResult, lastUpdatedAt] = await Promise.all([
      this.transactionRepository.findWithPagination(filters, pagination),
      this.transactionRepository.getLastUpdatedAt(),
    ]);

    // 4. 表示用データに変換（ビジネスロジック）
    const transactions = convertToDisplayTransactions(transactionResult.items);

    return { transactions, total, politicalOrganizations, ... };
  }
}
```

### Usecase内のロジック分類

Usecaseには以下の2種類のロジックが含まれます：

1. **Repositoryアクセスを伴うロジック**
   - データの取得・集約
   - 複数Repositoryの連携
   
2. **Repositoryアクセスを伴わないロジック**
   - 取得したデータの計算・変換（例: `calculateNetAssetsAndDebtExcess`）
   - フィルタやパラメータの構築
   - privateメソッドとして実装されることが多い

### Utilsとの使い分け

| 配置場所 | 特徴 | 例 |
|---------|------|-----|
| **Utils** | 汎用的、純粋関数、複数箇所で再利用される | `formatAmount()`, `convertToDisplayTransaction()` |
| **Usecase private** | 特定のドメイン専用、そのUsecaseでのみ使用、ドメイン知識を含む | `calculateNetAssetsAndDebtExcess()` |

```typescript
// Usecase内のprivateメソッド例
// webapp/src/server/usecases/get-balance-sheet-usecase.ts
private calculateNetAssetsAndDebtExcess(
  currentAssets: number,
  fixedAssets: number,
  currentLiabilities: number,
  fixedLiabilities: number,
): [netAssets: number, debtExcess: number] {
  const totalAssets = currentAssets + fixedAssets;
  const totalLiabilities = currentLiabilities + fixedLiabilities;
  const balance = totalAssets - totalLiabilities;

  if (balance >= 0) {
    return [balance, 0]; // 純資産あり
  } else {
    return [0, Math.abs(balance)]; // 債務超過あり
  }
}
```

このメソッドは会計ドメインの専門知識を含み、`GetBalanceSheetUsecase`でのみ使われるため、Utilsではなくprivateメソッドとして配置されています。

### 意図

- **責務の明確化**: ビジネスロジックをUsecaseに集約し、Loaderは「依存性注入とキャッシュ管理」に専念
- **再利用性**: 同じUsecaseを異なるエントリーポイント(Loader、Action、API Route)から利用可能
- **保守性**: ビジネスロジックの変更がUsecaseのみに閉じる

## 4. 細かいビジネスロジックの配置場所と設計意図

### `webapp/src/server/utils/` の役割

Usecaseにまとめるほどではない、純粋関数的な小さいビジネスロジックを配置します。

### 配置されているファイル

- `transaction-converter.ts`: トランザクションを表示用データに変換
- `financial-calculator.ts`: 金額の万円・億円単位へのフォーマット
- `sankey-category-converter.ts`: Sankey図用のカテゴリデータ変換
- `format-date.ts`: 日付フォーマット処理

### 実装例

```typescript
// webapp/src/server/utils/transaction-converter.ts
export function convertToDisplayTransaction(transaction: Transaction): DisplayTransaction {
  // 年月の生成
  const date = new Date(transaction.transaction_date);
  const yearmonth = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;

  // カテゴリマッピング取得
  const account = transaction.transaction_type === "expense" 
    ? transaction.debit_account 
    : transaction.credit_account;
  const categoryMapping = getCategoryMapping(account);

  // 金額計算
  const baseAmount = transaction.transaction_type === "expense"
    ? transaction.debit_amount
    : transaction.credit_amount;
  const absAmount = Math.abs(baseAmount);
  const amount = transaction.transaction_type === "expense" ? -absAmount : absAmount;

  return { id, date, yearmonth, transactionType, category, ... };
}
```

```typescript
// webapp/src/server/utils/financial-calculator.ts
export function formatAmount(amount: number): FormattedAmount {
  const absAmount = Math.abs(amount);
  const manAmount = Math.round(absAmount / 10000);
  
  if (manAmount >= 10000) {
    const oku = Math.floor(manAmount / 10000);
    const man = manAmount % 10000;
    return { main: `${oku}`, secondary: "億", tertiary: man.toString(), unit: "万円" };
  }
  return { main: `${manAmount}`, secondary: "", tertiary: "", unit: "万円" };
}
```

### 意図

- **純粋関数の集約**: 副作用のない、入力から出力への変換処理を集める
- **再利用性**: Usecase、Repository、Componentから共通で利用可能
- **テスタビリティ**: 純粋関数なので単体テストが容易
- **責務の分離**: Usecaseが肥大化するのを防ぐ

## 5. loadersとrepositoriesのロジック分離の意図

### Loaderの責務

**重要: Loaderは、Usecaseと実装Repository（具象クラス）にアクセスする唯一のレイヤーです。**

```typescript
// webapp/src/server/loaders/load-transactions-page-data.ts
import "server-only";
import { unstable_cache } from "next/cache";

export const loadTransactionsPageData = (params: GetTransactionsBySlugParams) => {
  const cacheKey = ["transactions-page-data", JSON.stringify(params)];

  return unstable_cache(
    async () => {
      // 1. 依存性の注入（具象Repositoryクラスのインスタンス化）
      const transactionRepository = new PrismaTransactionRepository(prisma);
      const politicalOrganizationRepository = 
        new PrismaPoliticalOrganizationRepository(prisma);
      
      // 2. Usecaseの初期化（Repositoryの注入）
      const usecase = new GetTransactionsBySlugUsecase(
        transactionRepository,
        politicalOrganizationRepository,
      );

      // 3. 実行
      return await usecase.execute(params);
    },
    cacheKey,
    { revalidate: CACHE_REVALIDATE_SECONDS },
  )();
};
```

### Loaderの特徴

- **Repositoryへの唯一のアクセスポイント**: 具象Repositoryクラスをインスタンス化するのはLoaderのみ
- **依存性注入の一元管理**: Repositoryのインスタンス化をLoaderに集約
- **キャッシュ管理**: Next.jsの`unstable_cache`を使ったキャッシュ戦略をLoaderで管理
- **テスタビリティ**: テスト時にはLoaderをバイパスして、UsecaseにモックRepositoryを直接注入できる

### 例外: シンプルなLoaderはPrismaに直接アクセス

Repository/Usecaseパターンを使わず、LoaderがPrismaに直接アクセスする場合もあります。

```typescript
// webapp/src/server/loaders/load-organizations.ts
export const loadOrganizations = unstable_cache(
  async (): Promise<OrganizationsResponse> => {
    const organizations = await prisma.organization.findMany({
      select: { slug: true, name: true, displayName: true },
      orderBy: { createdAt: "asc" },
    });
    
    return {
      default: organizations[0].slug,
      organizations: organizations.map((org) => ({...})),
    };
  },
  ["organizations"],
  { revalidate: 3600 },
);
```

#### なぜ直接アクセスするのか

- **シンプルな単一クエリ**: `findMany()`の1回のみ
- **ビジネスロジックがほぼない**: SELECT + 簡単なマッピング
- **再利用の必要性が低い**: 組織一覧取得という固有の処理
- **過剰な抽象化を避ける**: 複雑さのコスト > 保守性のベネフィット

#### Repository/Usecaseパターンを使うべきケース（比較）

対照的に、`GetTransactionsBySlugUsecase`のような複雑なケース：

- **複数のRepositoryを連携**（PoliticalOrganization + Transaction）
- **複雑なフィルタ構築**
- **エラーハンドリング**
- **データ変換ロジック**
- **テストで差し替える必要がある**

#### 設計判断の基準

```
抽象化すべきか？
├─ 複数のRepositoryを使う → YES
├─ 複雑なビジネスロジックがある → YES
├─ テストでモック化したい → YES
├─ 複数箇所で再利用する → YES
└─ シンプルな単一クエリ → NO（直接Prismaアクセスでよい）
```

この判断は**プラグマティズム（実用主義）**に基づいており、不要な複雑さを避けつつ、必要な箇所でのみ抽象化を行う設計です。

### Repositoryの責務

```typescript
// webapp/src/server/repositories/prisma-transaction.repository.ts
export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private prisma: PrismaClient) {}

  // データベースアクセスのみに専念
  async findWithPagination(...): Promise<PaginatedResult<Transaction>> {
    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderByClause(sortBy, order);
    
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({ where, orderBy, skip, take }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: transactions.map(this.mapToTransaction),
      total,
      page,
      perPage,
      totalPages,
    };
  }
  
  private buildWhereClause(...) { /* Prisma WHERE句構築 */ }
  private buildOrderByClause(...) { /* Prisma ORDER BY句構築 */ }
  private mapToTransaction(...) { /* PrismaモデルからTransactionへの変換 */ }
}
```

### ロジック分離の意図

| 層 | 責務 | 例 |
|---|---|---|
| **Loader** | 依存性注入（具象Repositoryのインスタンス化）、キャッシュ管理、Next.jsとの統合 | `unstable_cache`、`revalidate`、DI |
| **Usecase** | ビジネスロジック、複数リポジトリの連携、Repositoryアクセス | slug検証、フィルタ構築、エラーハンドリング |
| **Repository** | データアクセス、SQLクエリ構築、型変換 | `findMany`、`WHERE句構築`、`Prisma → Transaction変換` |
| **Utils** | 純粋関数的なデータ変換 | 日付フォーマット、金額表示変換 |

### 具体例: データフロー

```
1. App Router (page.tsx)
   ↓ サーバーコンポーネントとして実行
2. Loader (load-transactions-page-data.ts)
   - unstable_cache によるキャッシュ管理
   - Repository、Usecaseの依存性注入（Repositoryへの唯一のアクセス）
   ↓
3. Usecase (get-transactions-by-slug-usecase.ts)
   - slug から組織IDを取得（Repositoryアクセス）
   - フィルタとページネーションパラメータを構築
   - リポジトリから取得したデータを表示用に変換
   ↓
4. Repository (prisma-transaction.repository.ts)
   - WHERE句とORDER BY句を構築
   - Prismaクエリ実行
   - Prismaモデルをドメインモデル(Transaction)に変換
   ↓
5. Utils (transaction-converter.ts)
   - Transaction → DisplayTransaction への変換
   ↓
6. Component (TransactionsSection.tsx)
   - データを受け取って描画
```

## 6. Server Actionsの配置と利用

### Server Actionsの責務

`webapp/src/server/actions/` には、データ更新やファイルダウンロードなど、副作用を伴う操作を配置します。

### 実装例

```typescript
// webapp/src/server/actions/download-transactions-csv.ts
"use server";

import { loadTransactionsForCsv } from "@/server/loaders/load-transactions-for-csv";

export async function downloadTransactionsCsv(slug: string) {
  try {
    const data = await loadTransactionsForCsv({ slugs: [slug], financialYear: 2025 });
    
    // CSVデータ生成
    const csvContent = generateCsv(data.transactions);
    
    return { success: true, data: csvContent, filename: `transactions_${slug}.csv` };
  } catch (error) {
    return { success: false, error: "CSVのダウンロードに失敗しました" };
  }
}
```

### 意図

- **副作用の明示**: `"use server"` により、副作用を伴う処理であることを明示
- **クライアントからの呼び出し**: Clientコンポーネントから直接呼び出し可能
- **Loaderとの使い分け**: データ取得はLoader、データ更新・ダウンロードはAction

## まとめ

このアーキテクチャは、以下の設計原則に基づいています：

1. **サーバーとクライアントの厳格な分離** (`server-only`)
2. **依存性逆転の原則** (Interface + DI)
3. **単一責任の原則** (Loader、Usecase、Repository、Utilsの責務分離)
4. **テスタビリティと保守性** (純粋関数、疎結合)
5. **Next.js App Routerとの統合** (サーバーコンポーネント、キャッシュ管理)
6. **Loaderによる依存性の一元管理** (Repositoryへの唯一のアクセスポイント)
7. **プラグマティズム** (シンプルなケースは直接Prismaアクセス、複雑なケースは抽象化)

これらの設計思想に従うことで、拡張性が高く、テスト可能で、保守しやすいコードベースを維持できます。
