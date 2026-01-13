/**
 * DiceEngine - チンチロリンのサイコロロジック
 * 
 * 役の強さ（降順）:
 * 1. ピンゾロ (1,1,1) - 親の場合5倍、子の場合3倍
 * 2. アラシ (ゾロ目: 2,2,2 ~ 6,6,6) - 3倍
 * 3. シゴロ (4,5,6) - 2倍
 * 4. 通常の目 (2つ同じで残り1つが目) - 等倍、目の数字で勝負
 * 5. 目なし (ションベン) - 振り直し、3回で負け
 * 6. ヒフミ (1,2,3) - 即負け
 */

// 役の種類
export const HandType = {
    PINZORO: 'pinzoro',       // ピンゾロ (1,1,1) - 最強
    ARASHI: 'arashi',         // アラシ (ゾロ目)
    SHIGORO: 'shigoro',       // シゴロ (4,5,6)
    NORMAL: 'normal',         // 通常の目
    MENASHI: 'menashi',       // 目なし
    HIFUMI: 'hifumi'          // ヒフミ (1,2,3) - 最弱
};

// 役の強さランク（高いほど強い）
const HandRank = {
    [HandType.PINZORO]: 100,
    [HandType.ARASHI]: 80,    // + ゾロ目の数値
    [HandType.SHIGORO]: 70,
    [HandType.NORMAL]: 10,    // + 目の数値
    [HandType.MENASHI]: 0,
    [HandType.HIFUMI]: -100
};

// 配当倍率
export const Multiplier = {
    [HandType.PINZORO]: { dealer: 5, player: 3 },
    [HandType.ARASHI]: { dealer: 3, player: 3 },
    [HandType.SHIGORO]: { dealer: 2, player: 2 },
    [HandType.NORMAL]: { dealer: 1, player: 1 },
    [HandType.MENASHI]: { dealer: 1, player: 1 },
    [HandType.HIFUMI]: { dealer: 2, player: 2 } // ヒフミは2倍付け/2倍払い
};

export class DiceEngine {
    // テストモード: true にするとピンゾロとアラシが出やすくなる
    static TEST_MODE = false;

    /**
     * サイコロを振る
     * @param {number} count - 振るサイコロの数（デフォルト3）
     * @returns {number[]} 出目の配列
     */
    static roll(count = 3) {
        // テストモード: 50%の確率でピンゾロまたはアラシを返す
        if (DiceEngine.TEST_MODE && count === 3) {
            const rand = Math.random();
            if (rand < 0.25) {
                // 25%でピンゾロ
                return [1, 1, 1];
            } else if (rand < 0.50) {
                // 25%でアラシ（2〜6のゾロ目）
                const value = Math.floor(Math.random() * 5) + 2;
                return [value, value, value];
            }
            // 残り50%は通常ロール
        }

        const dice = [];
        for (let i = 0; i < count; i++) {
            dice.push(Math.floor(Math.random() * 6) + 1);
        }
        return dice;
    }


    /**
     * 出目から役を判定する
     * @param {number[]} dice - 3つのサイコロの出目
     * @returns {HandResult} 役の判定結果
     */
    static evaluateHand(dice) {
        if (dice.length !== 3) {
            throw new Error('チンチロリンは3つのサイコロが必要です');
        }

        const sorted = [...dice].sort((a, b) => a - b);
        const [d1, d2, d3] = sorted;

        // ヒフミ (1,2,3) - 即負け
        if (d1 === 1 && d2 === 2 && d3 === 3) {
            return {
                type: HandType.HIFUMI,
                value: 0,
                rank: HandRank[HandType.HIFUMI],
                dice: sorted,
                displayName: 'ヒフミ'
            };
        }

        // シゴロ (4,5,6) - 高配当役
        if (d1 === 4 && d2 === 5 && d3 === 6) {
            return {
                type: HandType.SHIGORO,
                value: 0,
                rank: HandRank[HandType.SHIGORO],
                dice: sorted,
                displayName: 'シゴロ'
            };
        }

        // ピンゾロ (1,1,1)
        if (d1 === 1 && d2 === 1 && d3 === 1) {
            return {
                type: HandType.PINZORO,
                value: 1,
                rank: HandRank[HandType.PINZORO],
                dice: sorted,
                displayName: 'ピンゾロ'
            };
        }

        // アラシ (ゾロ目)
        if (d1 === d2 && d2 === d3) {
            return {
                type: HandType.ARASHI,
                value: d1,
                rank: HandRank[HandType.ARASHI] + d1, // 目の大きさで強弱あり？通常はアラシ同士は引き分けだが、ここでは数値も加味
                dice: sorted,
                displayName: `アラシ(${d1})`
            };
        }

        // 通常の目 (2つ同じ)
        if (d1 === d2) { // [X, X, Y] -> Y
            return {
                type: HandType.NORMAL,
                value: d3,
                rank: HandRank[HandType.NORMAL] + d3,
                dice: sorted,
                displayName: `${d3}の目`
            };
        }
        if (d2 === d3) { // [X, Y, Y] -> X
            return {
                type: HandType.NORMAL,
                value: d1,
                rank: HandRank[HandType.NORMAL] + d1,
                dice: sorted,
                displayName: `${d1}の目`
            };
        }
        if (d1 === d3) { // [X, Y, X] -> Y (ソート済みなのでありえないが念のため)
            return {
                type: HandType.NORMAL,
                value: d2,
                rank: HandRank[HandType.NORMAL] + d2,
                dice: sorted,
                displayName: `${d2}の目`
            };
        }

        // 目なし（どのパターンにも該当しない）
        return {
            type: HandType.MENASHI,
            value: 0,
            rank: HandRank[HandType.MENASHI],
            dice: sorted,
            displayName: '目なし'
        };
    }

    /**
     * 2つの役を比較する
     * @param {HandResult} hand1 - 親の役
     * @param {HandResult} hand2 - 子の役
     * @param {boolean} forceResolution - trueの場合、目なしでも勝敗を強制決定する（デフォルトfalse）
     * @returns {CompareResult} 比較結果
     */
    static compareHands(hand1, hand2, forceResolution = false) {
        // 目なしの場合は特別処理（振り直し扱い）
        // forceResolution が true の場合は無視してランク比較へ
        if (!forceResolution && (hand1.type === HandType.MENASHI || hand2.type === HandType.MENASHI)) {
            return {
                winner: null,
                reason: 'menashi',
                needsReroll: hand1.type === HandType.MENASHI ? 'dealer' : 'player'
            };
        }

        // ランクで比較
        if (hand1.rank > hand2.rank) {
            return {
                winner: 'dealer',
                reason: `${hand1.displayName} > ${hand2.displayName}`,
                margin: hand1.rank - hand2.rank
            };
        } else if (hand1.rank < hand2.rank) {
            return {
                winner: 'player',
                reason: `${hand2.displayName} > ${hand1.displayName}`,
                margin: hand2.rank - hand1.rank
            };
        }

        // 同ランクの場合は引き分け（親の勝ち）
        return {
            winner: 'dealer',
            reason: '同点（親勝ち）',
            margin: 0
        };
    }

    /**
     * 配当倍率を取得
     * @param {HandResult} hand - 役
     * @param {boolean} isDealer - 親かどうか
     * @returns {number} 配当倍率
     */
    static getMultiplier(hand, isDealer) {
        const mult = Multiplier[hand.type];
        return isDealer ? mult.dealer : mult.player;
    }

    /**
     * 役の日本語名を取得
     * @param {HandType} type - 役の種類
     * @returns {string} 日本語名
     */
    static getHandTypeName(type) {
        const names = {
            [HandType.PINZORO]: 'ピンゾロ',
            [HandType.ARASHI]: 'アラシ',
            [HandType.SHIGORO]: 'シゴロ',
            [HandType.NORMAL]: '通常',
            [HandType.MENASHI]: '目なし',
            [HandType.HIFUMI]: 'ヒフミ'
        };
        return names[type] || '不明';
    }
}

/**
 * @typedef {Object} HandResult
 * @property {HandType} type - 役の種類
 * @property {number} value - 目の値（通常の目の場合）
 * @property {number} rank - 強さランク
 * @property {number[]} dice - ソート済みのサイコロ
 * @property {string} displayName - 表示用の役名
 */

/**
 * @typedef {Object} CompareResult
 * @property {'dealer'|'player'|null} winner - 勝者
 * @property {string} reason - 勝敗理由
 * @property {number} [margin] - ランク差
 * @property {'dealer'|'player'} [needsReroll] - 振り直しが必要なプレイヤー
 */
