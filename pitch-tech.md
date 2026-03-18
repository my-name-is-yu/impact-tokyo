# MimamoAI — 技術アーキテクチャ

---

## 技術スタック図

```
┌─────────────────────────────────────────────────────┐
│  ユーザー（家族介護者）                                │
│  PC / スマートフォン                                  │
└───────────────┬─────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────┐
│  フロントエンド                                       │
│  React + TypeScript + Tailwind CSS                   │
│  Firebase Hosting (CDN配信)                          │
└───────────────┬─────────────────────────────────────┘
                │ REST API / SSE (Server-Sent Events)
┌───────────────▼─────────────────────────────────────┐
│  バックエンド                                        │
│  Express.js on Cloud Functions for Firebase          │
│  Tokyo Region (asia-northeast1)                      │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ 記録構造化    │  │ 手続きガイド │  │ 報告書生成  │ │
│  │ API          │  │ API (SSE)   │  │ API        │ │
│  └──────┬───────┘  └──────┬──────┘  └──────┬─────┘ │
│         │                 │                │       │
│  ┌──────▼─────────────────▼────────────────▼─────┐ │
│  │          Claude API (Anthropic)                │ │
│  │  haiku: 記録構造化・異常検知（高速・低コスト）   │ │
│  │  sonnet: ガイド・報告書（高品質・対話）         │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────┐
│  データ層                                            │
│  Cloud Firestore（CareRecord / Report / GuideSession）│
│  Firebase Storage（添付写真）                        │
└─────────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────┐
│  AIオーケストレーション層                             │
│  n8n（異常検知 / 月次通知 / 記録リマインダー）        │
└─────────────────────────────────────────────────────┘
```

---

## AIオーケストレーション詳細

AIが「先回りして動く」核心部分。3つのワークフローが自律的に連携する。

### ワークフロー 1: 記録保存トリガー（異常検知）

```
記録入力（自然文）
    │
    ▼ POST /api/records/structure
[Claude haiku] 構造化 → Firestore 保存 (status=draft)
    │
    ▼ ユーザー確認後 PATCH → status=saved
[n8n Webhook トリガー]
    │
    ▼ 直近7日間の記録を Firestore から取得
[Claude haiku] 異常パターン分析
    │
    ├─ 異常なし → 終了
    │
    └─ 異常あり → Firestore に AlertNotification 書き込み
                    │
                    ▼ ホーム画面「AIからの気づき」に表示
                    │
                    ▼ ユーザーが「確認する」をタップ
                [Claude haiku] ケアマネへの連絡文自動起草
                    │
                    ▼ ユーザーが確認 → 送信完了
```

### ワークフロー 2: 月次自動処理

```
[n8n Cron: 毎月25日 9:00 JST]
    │
    ▼ 報告書未生成ユーザーを Firestore からクエリ
[Claude sonnet] 当月のケア記録を集約 → 報告書ドラフト生成
    │
    ▼ Firestore に Report ドキュメント (status=draft) を保存
通知「今月の報告書ドラフトを作成しました。確認しますか？」
    │
    ▼ ユーザーが確認・編集 → PDF出力 → 送信
```

### ワークフロー 3: 手続きガイド（対話内段階的処理）

```
ユーザーの質問（自由テキスト）
    │
    ▼ POST /api/guide/message
[Claude sonnet] 質問を手続きカテゴリに分類
    │
    ▼ SSE ストリーミングで逐次表示
ステップ一覧 + 必要書類 + 申請窓口 + 注意点
    │
    ▼ ユーザーが「書類を作成して」と入力
[Claude sonnet] 書類ドラフト生成 → インライン表示
    │
    ▼ テキストコピー or PDF出力
```

---

## Claude APIの使い分け

| 用途 | エンドポイント | モデル | 選定理由 |
|------|--------------|--------|---------|
| ケア記録構造化 | POST /api/records/structure | claude-3-5-haiku-20241022 | 高速・低コスト。定型JSON変換に最適。Temperature=0で安定出力 |
| 異常パターン検知 | POST /api/records/:id/analyze | claude-3-5-haiku-20241022 | 記録保存時に即時実行。レスポンス速度が重要 |
| ケアマネ連絡文起草 | POST /api/alerts/:id/generate-message | claude-3-5-haiku-20241022 | コスト最適化。定型的な連絡文生成に十分な品質 |
| 医師への通院メモ | POST /api/records/doctor-memo | claude-3-5-haiku-20241022 | コスト最適化。構造化出力（Markdown形式） |
| ヘルパー申し送り | POST /api/records/handover | claude-3-5-haiku-20241022 | コスト最適化。箇条書き形式のサマリー生成 |
| 入退院チェックリスト | POST /api/guide/checklist | claude-3-5-haiku-20241022 | JSON配列出力。Temperature=0.1で一貫性確保 |
| 手続きガイドチャット | POST /api/guide/message | claude-3-5-sonnet-20241022 | 複雑な制度理解・多ターン対話が必要。SSEストリーミング |
| 月次報告書生成 | POST /api/reports/generate | claude-3-5-sonnet-20241022 | 文章品質が重要。2000トークンの長文出力 |

**コスト戦略:** 高頻度・定型処理はhaiku、高品質・対話処理はsonnetに振り分け。ユーザー1人あたりのAPI費用を最小化。

---

## データフロー図（主要デモシナリオ）

```
[ユーザー入力]「食欲なし、混乱あり」
        │
        ▼ POST /api/records/structure
[Claude haiku] Temperature=0, max_tokens=1000
        │
        ▼ JSON構造化
{
  meal: { breakfast: "ほぼ摂取せず", ... },
  mental: { mood: "食欲低下", cognition: "軽度混乱", ... },
  ...
}
        │
        ▼ Firestore CareRecord (status=draft)
        │
        ▼ ユーザー確認 → PATCH status=saved
        │
        ▼ n8n Webhook トリガー
[n8n] 直近7日間の記録を取得
        │
        ▼ POST Claude haiku（異常検知）
{ detected: true, pattern: "食欲3日連続低下",
  severity: "high", suggestion: "ケアマネ報告推奨" }
        │
        ▼ Firestore AlertNotification 書き込み
        │
        ▼ ホーム画面「AIからの気づき」に表示
        │
        ▼ ユーザーが「確認する」→ /guide?auto=care_manager_report
[Claude haiku] ケアマネ連絡文起草
        │
        ▼ { subject, body, consultation_points }
        │
        ▼ ユーザー確認 → 送信完了
```

---

## セキュリティ・プライバシー

| 観点 | 実装内容 |
|------|---------|
| アクセス制御 | Firebase Security Rules でユーザーIDごとにデータを分離（userId フィールドで所有者チェック） |
| 通信暗号化 | Claude API・Firebase すべてHTTPS通信 |
| 写真ハンドリング | Firebase Storage に署名付きURL（有効期限付き）で保存。MIME type検証（jpeg/png/webpのみ） |
| 一時保存 | ネットワーク切断時はローカルストレージに入力を一時保存し、再接続後に再送信 |
| 写真のコスト最適化 | クライアント側でCanvas APIにより長辺1024px以下にリサイズしてからAPIへ送信 |
| 将来対応 | HIPAA準拠の検討、医療機関・事業者向けのエンタープライズ認証 |

---

## スケーラビリティ

| 要素 | 設計 |
|------|------|
| バックエンド | Firebase Cloud Functions — リクエスト数に応じて自動スケール。コールドスタート対策済み |
| データベース | Firestore NoSQL — スキーマレスで機能追加が容易。userId + careRecipientId でマルチテナント分離 |
| フロントエンド | Firebase Hosting CDN — 静的ファイルをグローバル配信 |
| AIコスト | haiku中心の設計でAPI費用を抑制。報告書・ガイドのみsonnetを使用 |
| n8nワークフロー | ユーザー数増加に応じてn8n Cloud Proでスケールアップ |

---

## コスト試算（月額/ユーザー）

| 項目 | 月額目安 | 前提 |
|------|---------|------|
| Claude API (haiku中心) | ~¥100〜300 | 日次記録1件、週次ガイド2回、月次報告1回 |
| Firebase Firestore | 無料枠内 | 月200万リード/50万ライトまで無料 |
| Firebase Hosting | 無料枠内 | 月10GBまで無料 |
| Cloud Functions | 無料枠内 | 月200万呼び出しまで無料 |
| n8n Cloud | ~¥100〜200 | ワークフロー実行回数による按分 |
| **合計** | **¥200〜500/ユーザー** | 月500〜1,500円のサブスク設定で黒字化可能 |

---

## 技術スタック一覧

| レイヤー | 採用技術 | 理由 |
|---------|---------|------|
| フロントエンド | React + TypeScript + Tailwind CSS | 型安全・高速開発。Lovableで雛形生成 |
| ホスティング | Firebase Hosting | CDN配信・無料枠・Firebaseエコシステムで完結 |
| バックエンド | Express.js + Cloud Functions for Firebase | Claude API呼び出しをサーバーサイドに隔離。APIキー保護 |
| データベース | Cloud Firestore | NoSQL・無料枠・ネストドキュメントでJSONデータを自然に格納 |
| 認証 | Firebase Authentication | Google OAuth対応・無料 |
| ストレージ | Firebase Storage | 写真の安全な保管・無料枠あり |
| AI（高速処理） | claude-3-5-haiku-20241022 | 記録構造化・異常検知・各種サマリー生成 |
| AI（高品質処理） | claude-3-5-sonnet-20241022 | 手続きガイドチャット・月次報告書生成 |
| オーケストレーション | n8n | 異常検知・月次自動処理・記録リマインダーのワークフロー自動化 |
| PDF生成 | window.print() + 印刷用CSS | ライブラリ不要。A4縦レイアウトをCSSで制御 |
| リアルタイム通信 | SSE (Server-Sent Events) | 手続きガイドのストリーミング表示。WebSocket不要で軽量 |
