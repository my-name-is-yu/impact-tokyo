"use strict";
// ─── Demo Seed Data ────────────────────────────────────────────────────────────
// Persona: caregiver "ゆう" caring for "田中節子" (78, care level 2, mild dementia)
Object.defineProperty(exports, "__esModule", { value: true });
exports.demoDocuments = exports.demoReports = exports.demoRecords = void 0;
// ─── Record generation helpers ─────────────────────────────────────────────────
function dateRange(start, end) {
    const dates = [];
    const cur = new Date(start);
    const fin = new Date(end);
    while (cur <= fin) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}
function getPhase(date) {
    if (date >= '2026-01-10' && date <= '2026-01-13')
        return 'sick';
    if (date >= '2026-01-14' && date <= '2026-02-10')
        return 'recovery';
    if (date >= '2026-03-05')
        return 'declining';
    return 'stable';
}
function pick(arr) {
    return arr[Math.floor(Math.abs(Math.sin(arr.length * 9301 + 49297)) * arr.length) % arr.length];
}
// Deterministic pseudo-random based on seed
function seededRand(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}
function buildRecord(index, date, time, phase) {
    const s = index + 1; // seed offset
    const stableRawInputs = [
        `朝食はおかゆを8割摂取。体温36.${Math.floor(seededRand(s) * 5) + 2}度。排尿4回、排便1回。気分は穏やか。`,
        `昼食は全量摂取。午後は少しうとうとしていた。血圧128/82。転倒なし。`,
        `夕食は7割摂取。入浴介助実施。皮膚状態良好。夜間覚醒なし。`,
        `朝食パンとスープを完食。散歩20分実施。表情明るく会話あり。服薬確認済み。`,
        `昼食はご飯とおかずを8割摂取。水分600ml。排尿5回。足のむくみなし。`,
        `朝食9割摂取。体温36.5度、血圧130/78。「今日は気分がいい」と話していた。`,
        `夕食8割摂取。テレビを楽しそうに見ていた。夜間2時頃一度トイレ。その後すぐ就寝。`,
        `朝食8割。昼食全量。夕食7割。水分800ml摂取。排尿4回、排便あり。機嫌良好。`,
        `朝食パン食。体温36.3度。昼食後に短時間昼寝。排尿4回。薬は朝夕とも服用。`,
        `昼食は好物の煮魚でよく食べた。午後は手芸をして過ごす。血圧125/80。気分良好。`,
    ];
    const sickRawInputs = [
        `朝から体温37.8度。食欲なく朝食は2割のみ。咳が出始めた。服薬させたが嘔気あり。`,
        `体温38.1度。食事はほとんど取れず。水分をスプーンで少量ずつ補給。ぐったりしている。`,
        `体温37.9度。昨夜は何度も咳で目が覚めた様子。朝食3割。受診を検討中。`,
        `体温38.2度。かかりつけ医に受診。風邪との診断。解熱剤処方。水分補給を続ける。`,
    ];
    const recoveryRawInputs = [
        `体温36.9度まで下がった。朝食5割摂取。まだ咳が残っている。水分600ml。`,
        `体温36.7度。食欲が少し戻ってきた。朝食6割、昼食5割。声に張りが出てきた。`,
        `体温36.5度。食事量が回復してきた。7割摂取。「やっと楽になった」と話していた。`,
        `体温36.4度。ほぼ平熱に戻る。食事8割摂取。日中は椅子に座って過ごせた。`,
        `体温36.4度。食欲戻り昼食全量摂取。ただし時折混乱した言動が見られる。`,
        `朝から少し混乱した様子。「ここはどこ？」と繰り返す。食事7割。服薬確認。`,
        `昨夜2回覚醒。昼間は眠そうにしていた。食事7割。混乱は昨日より少なかった。`,
        `夜間の覚醒が続いている。日中の活動量を増やすよう心がけた。食事7割。`,
        `日中に短い混乱エピソードあり。夕方には落ち着いた。食事8割。`,
        `睡眠の乱れが少し改善。食事もほぼ回復。体調は安定しつつある。`,
    ];
    const decliningRawInputs = [
        `朝食は半量程度。少し元気がない様子。排尿3回。水分500ml。`,
        `食欲がなく朝食ほとんど食べられず。夜間2回覚醒。少し混乱あり。`,
        `本日も食欲なし。水分を少量摂取できたのみ。表情が乏しくぼーっとしている。`,
    ];
    let rawInput;
    if (phase === 'sick') {
        rawInput = sickRawInputs[index % sickRawInputs.length];
    }
    else if (phase === 'recovery') {
        rawInput = recoveryRawInputs[index % recoveryRawInputs.length];
    }
    else if (phase === 'declining') {
        rawInput = decliningRawInputs[index % decliningRawInputs.length];
    }
    else {
        rawInput = stableRawInputs[index % stableRawInputs.length];
    }
    // Build structuredData based on phase
    let meal;
    let sleep;
    let physical;
    let mental;
    let special_notes;
    if (phase === 'stable') {
        const mealPct = ['7割', '8割', '9割', '全量'][Math.floor(seededRand(s) * 4)];
        meal = {
            breakfast: `${mealPct}摂取`,
            lunch: `${['8割', '9割', '全量'][Math.floor(seededRand(s + 1) * 3)]}摂取`,
            dinner: `${['7割', '8割', '9割'][Math.floor(seededRand(s + 2) * 3)]}摂取`,
            hydration: `${500 + Math.floor(seededRand(s + 3) * 4) * 100}ml`,
        };
        sleep = { hours: 6 + Math.floor(seededRand(s + 4) * 3), quality: '良好、途中覚醒なし' };
        physical = {
            temperature: 36.2 + Math.round(seededRand(s + 5) * 6) / 10,
            pain: 'なし',
            edema: 'なし',
            other: `血圧${120 + Math.floor(seededRand(s + 6) * 20)}/${70 + Math.floor(seededRand(s + 7) * 15)}`,
        };
        mental = { mood: '穏やか', cognition: '問題なし', behavior: '特になし' };
        special_notes = '特になし';
    }
    else if (phase === 'sick') {
        meal = { breakfast: '2〜3割摂取', lunch: 'ほぼ摂取不可', dinner: '摂取困難', hydration: '少量（スプーンで補給）' };
        sleep = { hours: 4, quality: '発熱のため断続的、咳で覚醒' };
        physical = {
            temperature: 37.8 + Math.round(seededRand(s) * 4) / 10,
            pain: '咽頭痛・倦怠感',
            edema: 'なし',
            other: '風邪症状あり',
        };
        mental = { mood: '元気なし', cognition: '発熱による軽度混乱', behavior: 'ぐったりしている' };
        special_notes = '発熱・風邪症状のため安静。水分補給を優先。';
    }
    else if (phase === 'recovery') {
        const recIdx = index % 10;
        const mealPcts = ['3割', '4割', '5割', '6割', '7割', '7割', '8割', '8割', '8割', '9割'];
        meal = {
            breakfast: `${mealPcts[recIdx]}摂取`,
            lunch: `${mealPcts[Math.min(recIdx + 1, 9)]}摂取`,
            dinner: `${mealPcts[Math.max(recIdx - 1, 0)]}摂取`,
            hydration: `${400 + recIdx * 50}ml`,
        };
        sleep = { hours: 5 + Math.floor(recIdx / 3), quality: recIdx < 5 ? '夜間覚醒あり' : '改善傾向' };
        physical = {
            temperature: 36.5 + Math.round(seededRand(s) * 4) / 10,
            pain: recIdx < 3 ? '軽度の咽頭痛' : 'なし',
            edema: 'なし',
            other: `体温回復中`,
        };
        mental = {
            mood: recIdx < 5 ? 'やや不安定' : '改善中',
            cognition: recIdx < 5 ? '時折混乱あり' : 'ほぼ正常',
            behavior: recIdx < 5 ? '繰り返し発言が見られる' : '特になし',
        };
        special_notes = recIdx < 5 ? '風邪からの回復中。認知面の変動に注意。' : '体調回復傾向。食事量も増加。';
    }
    else {
        // declining
        const declIdx = index % 3;
        meal = {
            breakfast: ['半量程度', 'ほとんど摂取できず', 'ほとんど摂取できず'][declIdx],
            lunch: ['記録なし', '記録なし', '記録なし'][declIdx],
            dinner: ['記録なし', '記録なし', '記録なし'][declIdx],
            hydration: ['500ml', '少量のみ', '少量のみ'][declIdx],
        };
        sleep = {
            hours: null,
            quality: ['記録なし', '夜間2回覚醒', '記録なし'][declIdx],
        };
        physical = {
            temperature: null,
            pain: '記録なし',
            edema: '記録なし',
            other: '記録なし',
        };
        mental = {
            mood: ['少し元気がない', '食欲低下・混乱あり', '表情乏しくぼーっとしている'][declIdx],
            cognition: ['記録なし', '軽度混乱', '反応が遅い'][declIdx],
            behavior: '記録なし',
        };
        special_notes = ['', '食欲低下続く', '食欲低下3日目。認知面の変化あり。'][declIdx];
    }
    const elimination = {
        urine_count: phase === 'sick' ? 2 : phase === 'declining' ? null : 4 + Math.floor(seededRand(s + 8) * 2),
        stool: phase === 'stable' ? (seededRand(s + 9) > 0.5 ? 'あり（普通便）' : '記録なし') : '記録なし',
    };
    const medication = {
        taken: phase === 'sick' ? null : true,
        notes: phase === 'sick' ? '嘔気のため服薬困難' : '朝夕の降圧剤服用済み',
    };
    const fall_risk = phase === 'declining' ? '中程度（ふらつきに注意）' : phase === 'sick' ? '中程度（発熱で歩行不安定）' : '低い';
    const care_given_map = {
        stable: ['朝食介助', '服薬確認', '体温・血圧測定'],
        sick: ['水分補給介助', '体温測定（複数回）', '安静保持'],
        recovery: ['食事介助', '服薬確認', '体温測定'],
        declining: ['朝食介助', '水分補給介助'],
    };
    const dt = new Date(`${date}T${time}:00`);
    return {
        id: `rec-${index + 1}`,
        userId: 'demo-user-1',
        careRecipientId: 'demo-recipient-1',
        recordDate: date,
        recordTime: time,
        rawInput,
        structuredData: {
            meal,
            elimination,
            sleep,
            medication,
            physical,
            mental,
            fall_risk,
            special_notes,
            care_given: care_given_map[phase],
        },
        photos: [],
        status: 'saved',
        createdAt: dt,
        updatedAt: dt,
    };
}
// ─── Generate ~100 records spanning 2025-11-01 to 2026-03-07 ──────────────────
const times = ['07:30', '08:00', '07:45', '08:15', '07:30', '08:00', '07:45'];
function generateRecords() {
    const allDates = dateRange('2025-11-01', '2026-03-07');
    const records = [];
    let idx = 0;
    // days that get 2 records (every ~5th day)
    const doubleDays = new Set();
    allDates.forEach((d, i) => {
        if (i % 5 === 2)
            doubleDays.add(d);
    });
    for (const date of allDates) {
        if (records.length >= 100)
            break;
        const phase = getPhase(date);
        const time = times[idx % times.length];
        records.push(buildRecord(idx, date, time, phase));
        idx++;
        if (doubleDays.has(date) && records.length < 100) {
            // second record same day, afternoon time
            records.push(buildRecord(idx, date, '18:00', phase));
            idx++;
        }
    }
    // Ensure exactly the 3 most-recent declining records are the original demo records
    // (rec-98, rec-99, rec-100 will map to March 5, 6, 7)
    // We override the last 3 with the canonical declining records so alerts still match
    const last3 = records.slice(-3);
    const decliningDates = ['2026-03-05', '2026-03-06', '2026-03-07'];
    const decliningTimes = ['08:00', '07:30', '07:45'];
    const decliningRaw = [
        '朝食は半量程度。少し元気がない様子。排尿3回。水分500ml。',
        '食欲がなく朝食ほとんど食べられず。夜間2回覚醒。少し混乱あり。',
        '本日も食欲なし。水分を少量摂取できたのみ。表情が乏しくぼーっとしている。',
    ];
    for (let i = 0; i < 3 && i < last3.length; i++) {
        last3[i].recordDate = decliningDates[i];
        last3[i].recordTime = decliningTimes[i];
        last3[i].rawInput = decliningRaw[i];
        const dt = new Date(`${decliningDates[i]}T${decliningTimes[i]}:00`);
        last3[i].createdAt = dt;
        last3[i].updatedAt = dt;
    }
    return records;
}
exports.demoRecords = generateRecords();
// ─── Reports ───────────────────────────────────────────────────────────────────
exports.demoReports = [
    {
        id: 'report-1',
        careRecipientId: 'demo-recipient-1',
        periodStart: '2025-11-01',
        periodEnd: '2025-11-30',
        templateType: 'standard',
        additionalNotes: '',
        overallAssessment: '11月は全体的に安定した状態が続きました。食事摂取量は概ね7〜9割と良好で、体重の大きな変動も見られませんでした。血圧は130/80前後で推移し、かかりつけ医の指導範囲内でした。認知機能も比較的安定しており、日常的な会話や簡単な作業に取り組むことができました。',
        adlSummary: '歩行は手すりを使用しながらも自室内は概ね自立。食事は見守り・一部介助で摂取可能。排泄はほぼ自立（夜間のみ声掛け必要）。入浴は週2回、介助にて実施。更衣・整容は声掛けにより自分で行うことが多かった。',
        mentalSummary: '精神面は穏やかな日が多く、好きなテレビ番組を楽しむ様子が見られました。軽度の短期記憶障害は持続していますが、日常生活に大きな支障はありませんでした。夜間の不穏は月に2〜3回程度認められました。',
        incidents: '特記すべきインシデントなし。月中旬に軽い転倒リスクの場面が一度あったが、怪我には至らなかった。',
        handoverNotes: '引き続き現在のケアプランを継続。12月は年末年始の環境変化に伴う混乱に注意が必要。服薬管理を徹底し、血圧値のモニタリングを継続してください。',
        createdAt: new Date('2025-12-02'),
    },
    {
        id: 'report-2',
        careRecipientId: 'demo-recipient-1',
        periodStart: '2025-12-01',
        periodEnd: '2025-12-31',
        templateType: 'standard',
        additionalNotes: '',
        overallAssessment: '12月は年末の環境変化にもかかわらず比較的安定して過ごせました。クリスマスや年末年始の行事に参加し、楽しそうにしている姿が見られました。食事摂取は概ね良好で、体重は前月とほぼ変わらず。ただし月末にかけて若干の睡眠リズムの乱れが見られ始めました。',
        adlSummary: 'ADLは11月とほぼ同水準を維持。年末の来客により普段と異なる環境になることが多く、一時的に歩行の不安定さが見られた場面もありました。入浴介助は継続。食事は好物を提供すると全量摂取できる日が多くありました。',
        mentalSummary: '家族の来訪で表情が明るくなる場面が多く見られました。一方、慣れない場所や人物に対する混乱も数回ありました。「家に帰りたい」との発言が月末に2回ありましたが、声掛けで落ち着きました。',
        incidents: '12月28日、居間でのつまずきがあった。転倒には至らなかったが、床に散乱していた物への注意が必要と判断し、環境整備を実施。',
        handoverNotes: '1月は新年の環境変化に注意。定期受診を予定通り実施すること。睡眠リズムの乱れが継続する場合は主治医へ相談を検討してください。',
        createdAt: new Date('2026-01-03'),
    },
    {
        id: 'report-3',
        careRecipientId: 'demo-recipient-1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        templateType: 'standard',
        additionalNotes: '',
        overallAssessment: '1月は月初めは安定していましたが、1月10〜13日にかけて発熱（最高38.2度）を伴う風邪を発症しました。かかりつけ医を受診し、風邪と診断され解熱剤を処方。その後14日以降は体温が平熱に戻りましたが、食欲回復に時間がかかり、月の後半まで回復期が続きました。発熱期間中は食事摂取量が著しく低下し、水分補給を優先しました。',
        adlSummary: '発熱期間中は安静臥床が多く、一時的にADLが低下しました。回復後も体力の回復に伴い段階的にADLが戻り、月末には概ねもとの水準に近づきました。入浴は発熱期間中は清拭に変更し、回復後に再開しました。',
        mentalSummary: '発熱時および回復期に認知機能の変動が見られました。時折「ここはどこ？」と繰り返す場面や、家族の顔を一時的に認識できない場面もありました。体調の回復とともに認知面も改善傾向にありますが、引き続き観察が必要です。',
        incidents: '1月10〜13日：発熱による体調不良、かかりつけ医受診。1月11日：発熱中の一時的な歩行困難（ベッドサイドで支えが必要）。転倒なし。',
        handoverNotes: '2月は感染予防を徹底すること。認知機能の変動が続く場合は主治医への相談を検討。食事摂取量の回復経過を継続観察してください。',
        createdAt: new Date('2026-02-03'),
    },
    {
        id: 'report-4',
        careRecipientId: 'demo-recipient-1',
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
        templateType: 'standard',
        additionalNotes: '',
        overallAssessment: '2月は1月の風邪からの回復が続き、月後半には食事摂取量もほぼ回復しました。ただし月全体を通して睡眠の乱れや認知機能の変動が見られ、安定した状態とは言い難い時期でした。血圧は概ね130〜140/80〜90の範囲で推移し、若干高めの日もありました。転倒・受診が必要な急変はありませんでした。',
        adlSummary: '1月の発熱・回復を経てADLは概ね安定しましたが、体力的な低下が若干見られました。歩行時のふらつきが月前半に時々見られたため、移動時の見守りを強化しました。食事は月後半に改善し、7〜8割の摂取が安定してきました。',
        mentalSummary: '認知面では月前半に混乱エピソードが複数回ありました（「今日は何日？」「息子はどこ？」など）。夜間の覚醒も続き、不眠傾向が見られました。月後半から徐々に安定し、日中の覚醒水準も上がってきました。',
        incidents: '特記すべき転倒・受診は発生していません。2月15日、夜間の不穏あり、30分程度声掛けにて対応。介護者への精神的負担に配慮が必要です。',
        handoverNotes: '3月は認知機能の変動と睡眠状態の経過観察を継続してください。食欲の変動にも注意が必要です。必要に応じてかかりつけ医への相談をご検討ください。介護者の負担軽減のため、レスパイトケアの利用も検討に値します。',
        createdAt: new Date('2026-03-02'),
    },
];
// ─── Documents ─────────────────────────────────────────────────────────────────
exports.demoDocuments = [
    {
        id: 'doc-1',
        type: 'doctor_memo',
        title: '受診メモ（1月15日 内科）',
        content: `## 受診メモ — 2026年1月15日（内科）

### 基本情報
田中節子（78歳、要介護2、軽度認知症、高血圧治療中）

### 受診目的
1月10〜13日にかけての発熱（最高38.2度）の経過確認。かかりつけ医への報告と今後の対応相談。

### 最近の変化（優先順位順）
- **発熱（1/10〜1/13）:** 最高38.2度。かかりつけ医受診済みで風邪と診断、解熱剤処方。1/14より平熱に回復。
- **食欲低下（1/10〜）:** 発熱中は食事がほとんど摂れず。水分補給を優先。現在も7割程度に留まっている。
- **認知機能の変動（1/12〜）:** 「ここはどこ？」と繰り返す場面、家族の顔を一時的に認識できない場面が見られた。

### バイタル・食事記録
- 体温: 発熱時38.0〜38.2度 → 1/14より36.5度前後
- 血圧: 発熱中は測定困難な日もあり
- 食事摂取量: 2〜3割（発熱中）→ 5〜6割（回復期）

### 服薬状況
- 発熱中は嘔気があり服薬が難しい日があった
- 解熱剤は指示通り服用

### 先生に確認したい点
1. 発熱による認知機能低下は一時的なものか、継続的な経過観察が必要か
2. 食欲が回復しない場合の対応について
3. 高血圧薬の服薬が不規則になってしまった際の対処法

### 日常生活の変化
- 発熱中はほぼ臥床状態
- 歩行時に一時的なふらつきが見られた（転倒なし）`,
        createdAt: new Date('2026-01-15'),
    },
    {
        id: 'doc-2',
        type: 'checklist',
        title: '入院準備チェックリスト',
        content: `## 入院準備チェックリスト — 田中節子

作成日: 2026年1月10日（発熱時の緊急入院を念頭に作成）

### 書類・手続き
- [ ] 入院申込書の記入・提出
- [ ] 健康保険証・介護保険証を持参
- [ ] 限度額適用認定証の準備
- [ ] お薬手帳・診察券を持参
- [ ] 既往症・アレルギー情報シートの印刷

### 衣類・日用品
- [ ] パジャマ・着替え3〜5セット（前開きタイプ推奨）
- [ ] タオル・バスタオル
- [ ] 洗面用具（歯ブラシ、シャンプーなど）
- [ ] 補聴器・眼鏡などの補助具
- [ ] 滑りにくい室内履き

### 服薬・医療
- [ ] 現在の内服薬（または薬情）を持参
- [ ] かかりつけ医への連絡・紹介状の手配
- [ ] アレルギー情報の申告（ペニシリン系注意）

### 連絡・引き継ぎ
- [ ] ケアマネジャーに入院を連絡する
- [ ] デイサービスのキャンセル連絡
- [ ] 訪問介護のキャンセル連絡
- [ ] 緊急連絡先リストの確認

### 認知症対応の備考
- 環境変化による混乱が生じやすいため、馴染みの物（写真、タオルなど）を持参
- ナースコールの使い方を繰り返し説明する
- 夜間の不穏に備えてスタッフへ事前に申し伝える`,
        createdAt: new Date('2026-01-10'),
    },
    {
        id: 'doc-3',
        type: 'handover',
        title: '引き継ぎ資料（2月）',
        content: `【引き継ぎ資料】2026年2月

■ 申し送り先
訪問介護ヘルパー・デイサービスご担当者様

■ 注意が必要な点（重要度順）
- 1月の発熱・風邪からの回復期にあります。体力低下に伴いふらつきが見られることがあるため、移動時は必ず付き添ってください。
- 認知機能の変動が見られます。時刻・日付の見当識が不安定なため、穏やかに声掛けをお願いします。
- 夜間の覚醒が続いています。日中の活動と水分摂取のバランスに配慮してください。

■ 身体状況
- 食事: 7〜8割程度（好物はよく食べる。無理強いは逆効果）
- 排泄: 昼間はほぼ自立、夜間のみ声掛けが必要
- 睡眠: 夜間1〜2回の覚醒あり、日中うとうとする場面も
- バイタル: 体温36.5度前後（発熱リスク引き続き注意）、血圧やや高め

■ 精神・認知状況
- 軽度の混乱エピソードが週1〜2回程度あり
- 「家に帰りたい」との発言が時々見られる（否定せず共感で対応）
- 家族の写真を見せると落ち着く傾向あり

■ 服薬
- 朝夕の降圧剤は引き続き確認をお願いします
- 嘔気がある際は無理に服薬させず、家族に連絡してください

■ その他
- 2月15日頃に神経内科受診を予定しています
- ご不明な点はゆう（家族・介護者）までご連絡ください`,
        createdAt: new Date('2026-02-01'),
    },
    {
        id: 'doc-4',
        type: 'insurance_form',
        title: '介護保険更新申請書類',
        content: `## 介護保険更新申請 準備資料

### 対象者
田中節子（78歳）
現在の認定: 要介護2
有効期間満了: 2026年4月30日

### 更新申請の準備チェックリスト

#### 申請書類
- [ ] 介護保険 要介護認定・要支援認定申請書（市区町村窓口またはダウンロード）
- [ ] 介護保険被保険者証
- [ ] 医療保険の被保険者証（コピー）
- [ ] 主治医意見書（主治医に依頼）

#### 主治医意見書の依頼
- [ ] かかりつけ医（内科・神経内科）に依頼
- [ ] 現在の状態を口頭でも伝える（1月の発熱による認知機能変動など）
- [ ] 依頼から完成まで2〜3週間見込む

#### 申請窓口
- 提出先: 居住市区町村の介護保険担当窓口
- 代理申請: 家族・ケアマネジャーが可能
- 提出期限: 有効期限の60日前（2026年3月1日）が目安

#### 認定調査の準備
- [ ] 調査当日は普段通りの様子を見せること（良くも悪くも見せようとしない）
- [ ] 普段困っていることのメモを準備する
- [ ] 直近の体調変化（1月の発熱、認知機能の変動）を伝える

### 現在の状況メモ（調査員への申し送り用）
- 歩行: 手すりを使用しながら室内は概ね自立。屋外は見守りが必要。
- 食事: 見守り・一部介助で摂取可能。食欲にムラあり。
- 排泄: 昼間はほぼ自立、夜間のみ声掛け必要。
- 入浴: 週2回、全介助。
- 認知: 短期記憶障害あり。時折見当識の混乱（時刻・場所）。
- 服薬: 管理は家族が行っている。`,
        createdAt: new Date('2026-02-15'),
    },
    {
        id: 'doc-5',
        type: 'doctor_memo',
        title: '受診メモ（3月1日 神経内科）',
        content: `## 受診メモ — 2026年3月1日（神経内科）

### 基本情報
田中節子（78歳、要介護2、軽度認知症、高血圧治療中）

### 受診目的
1月の発熱後から認知機能の変動が続いているため、神経内科での評価を依頼。

### 最近の変化（優先順位順）
- **認知機能の変動（1月中旬〜）:** 「ここはどこ？」「今日は何日？」など見当識の混乱が週1〜2回程度。家族の顔が一時的にわからなくなる場面もあった。
- **睡眠障害（1月末〜）:** 夜間に1〜2回覚醒することが多い。日中のうとうとも目立つ。
- **食欲の低下（3月上旬）:** 3月5日頃から朝食の摂取量が減少傾向。

### バイタル・食事記録
- 体温: 36.4〜36.6度で安定
- 血圧: 132〜140/82〜88（若干高め）
- 食事摂取量: 2月は7〜8割 → 3月に入り5〜6割に低下傾向

### 服薬状況
- 高血圧薬（朝夕）: 概ね服用できている
- 発熱時の服薬中断後に認知機能変動が始まった印象あり

### 先生に確認したい点
1. 1月の発熱を契機とした認知機能の変動は一時的なものか、進行性のものか
2. 夜間の睡眠障害への対応（薬物療法の適否含む）
3. 最近の食欲低下が認知症の進行と関係している可能性はあるか
4. 現在の服薬内容で認知機能への影響がないか確認したい

### 日常生活の変化
- 以前は楽しんでいたテレビ番組への関心が薄れてきた
- 会話の反応速度が若干遅くなった気がする
- 夕方以降に混乱しやすい傾向（サンダウニング）`,
        createdAt: new Date('2026-03-01'),
    },
];
//# sourceMappingURL=demo-seed.js.map