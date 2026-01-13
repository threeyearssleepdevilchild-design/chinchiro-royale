/**
 * CheatTracker - イカサマ追跡・ダウト判定
 * 
 * イカサマスキルの使用を記録し、ダウト（イカサマ指摘）の判定を行う。
 */

export class CheatTracker {
    constructor() {
        /** @type {CheatEntry[]} */
        this.cheatLog = [];

        /** @type {number} 現在のラウンド */
        this.currentRound = 0;
    }

    /**
     * イカサマを記録
     * @param {string} playerId - イカサマを行ったプレイヤーID
     * @param {string} skillId - 使用したスキルID
     * @param {number} roundNumber - ラウンド番号
     */
    logCheat(playerId, skillId, roundNumber) {
        this.cheatLog.push({
            playerId,
            skillId,
            roundNumber,
            timestamp: Date.now(),
            doubted: false,
            doubterId: null
        });
    }

    /**
     * ダウトを実行
     * @param {string} accuserId - 告発者のプレイヤーID
     * @param {string} targetId - 告発対象のプレイヤーID
     * @param {number} [roundNumber] - 対象ラウンド（省略時は現在のラウンド）
     * @returns {DoubtResult}
     */
    checkDoubt(accuserId, targetId, roundNumber = null) {
        const targetRound = roundNumber ?? this.currentRound;

        // 対象プレイヤーの該当ラウンドでのイカサマを検索
        const cheatEntry = this.cheatLog.find(
            entry => entry.playerId === targetId &&
                entry.roundNumber === targetRound &&
                !entry.doubted
        );

        if (cheatEntry) {
            // イカサマ発見！ダウト成功
            cheatEntry.doubted = true;
            cheatEntry.doubterId = accuserId;

            return {
                success: true,
                caught: true,
                cheaterId: targetId,
                skillId: cheatEntry.skillId,
                message: `ダウト成功！${targetId}はイカサマをしていました！`,
                penalty: this.calculatePenalty(cheatEntry.skillId)
            };
        } else {
            // イカサマはなかった → ダウト失敗
            return {
                success: true,
                caught: false,
                accuserId,
                targetId,
                message: `ダウト失敗...${targetId}はイカサマをしていませんでした`,
                penalty: this.calculateFalseAccusationPenalty()
            };
        }
    }

    /**
     * イカサマ発覚時のペナルティを計算
     * @param {string} skillId - スキルID
     * @returns {Object}
     */
    calculatePenalty(skillId) {
        // スキルごとにペナルティを変えることも可能
        const penalties = {
            'god_hand': { chipLoss: 500, message: 'GODの力を悪用した罰' },
            'default': { chipLoss: 300, message: 'イカサマのペナルティ' }
        };

        return penalties[skillId] || penalties['default'];
    }

    /**
     * 誤ったダウト時のペナルティ
     * @returns {Object}
     */
    calculateFalseAccusationPenalty() {
        return {
            chipLoss: 100,
            message: '無実の人を疑った罰'
        };
    }

    /**
     * 特定プレイヤーが現在のラウンドでイカサマをしたかチェック
     * @param {string} playerId 
     * @param {number} [roundNumber]
     * @returns {boolean}
     */
    hasCheatInRound(playerId, roundNumber = null) {
        const targetRound = roundNumber ?? this.currentRound;
        return this.cheatLog.some(
            entry => entry.playerId === playerId &&
                entry.roundNumber === targetRound &&
                !entry.doubted
        );
    }

    /**
     * ラウンド終了時の処理
     */
    onRoundEnd() {
        // 未発覚のイカサマはそのまま（後から指摘不可にする場合はここでクリア）
    }

    /**
     * 新しいラウンド開始
     * @param {number} roundNumber 
     */
    startRound(roundNumber) {
        this.currentRound = roundNumber;
    }

    /**
     * ゲーム終了時にイカサマログを取得（統計用）
     * @returns {CheatEntry[]}
     */
    getCheatLog() {
        return [...this.cheatLog];
    }

    /**
     * リセット
     */
    reset() {
        this.cheatLog = [];
        this.currentRound = 0;
    }
}

/**
 * @typedef {Object} CheatEntry
 * @property {string} playerId - イカサマを行ったプレイヤーID
 * @property {string} skillId - 使用したスキルID
 * @property {number} roundNumber - ラウンド番号
 * @property {number} timestamp - タイムスタンプ
 * @property {boolean} doubted - ダウトされたか
 * @property {string|null} doubterId - ダウトした人のID
 */

/**
 * @typedef {Object} DoubtResult
 * @property {boolean} success - ダウト処理が成功したか
 * @property {boolean} caught - イカサマを発見したか
 * @property {string} [cheaterId] - イカサマ師のID
 * @property {string} [skillId] - 使用されたスキルID
 * @property {string} [accuserId] - 告発者のID
 * @property {string} [targetId] - 告発対象のID
 * @property {string} message - 結果メッセージ
 * @property {Object} penalty - ペナルティ情報
 */

export default CheatTracker;
