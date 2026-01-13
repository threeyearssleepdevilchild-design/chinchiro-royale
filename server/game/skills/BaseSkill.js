/**
 * BaseSkill - スキルの基底クラス
 * 
 * 全てのスキルはこのクラスを継承して実装する。
 * 各フックメソッドをオーバーライドすることで、ゲームの様々なタイミングに介入できる。
 */

/**
 * スキルフックの発火タイミング
 */
export const SkillHookTiming = {
    ROUND_START: 'round_start',           // ラウンド開始時
    BEFORE_ROLL: 'before_roll',           // ダイスを振る前
    AFTER_ROLL: 'after_roll',             // ダイスを振った後
    RESULT_CALCULATION: 'result_calculation', // 結果計算時
    INTERRUPT: 'interrupt'                // 割り込み（ダウト等）
};

/**
 * 非同期アクションの種類
 */
export const AsyncActionType = {
    REROLL_DECISION: 'reroll_decision',       // 振り直し判断
    TARGET_SELECT: 'target_select',           // ターゲットプレイヤー選択
    DICE_SELECT: 'dice_select',               // 自分のダイス選択
    DICE_SELECT_MULTI: 'dice_select_multi',   // 複数ダイス選択（3 of 4など）
    TARGET_DICE_SELECT: 'target_dice_select', // 相手のダイス選択
    SWAP_SELECT: 'swap_select',               // 交換選択（自分と相手のダイス）
    CONFIRM: 'confirm',                       // 確認
    VISUAL_EFFECT: 'visual_effect'            // ビジュアル効果適用
};

export class BaseSkill {
    constructor() {
        /** @type {string} スキルID */
        this.id = 'base';

        /** @type {string} スキル名 */
        this.name = 'ベーススキル';

        /** @type {string} スキル説明 */
        this.description = '';

        /** @type {boolean} イカサマフラグ（ダウト対象） */
        this.isCheat = false;

        /** @type {boolean} 使用済みフラグ */
        this.isUsed = false;

        /** @type {number} クールダウン残りラウンド数 */
        this.cooldownRemaining = 0;

        /** @type {number} 初期クールダウン */
        this.cooldown = 0;

        /** @type {boolean} パッシブスキルかどうか */
        this.isPassive = false;

        /** @type {number} 使用可能回数（-1 = 無制限） */
        this.maxUses = 1;

        /** @type {number} 現在の使用回数 */
        this.useCount = 0;
    }

    /**
     * スキルが使用可能かチェック
     * @returns {boolean}
     */
    canUse() {
        if (this.cooldownRemaining > 0) return false;
        if (this.maxUses !== -1 && this.useCount >= this.maxUses) return false;
        return true;
    }

    /**
     * スキル使用をマーク
     */
    markUsed() {
        this.useCount++;
        if (this.maxUses !== -1 && this.useCount >= this.maxUses) {
            this.isUsed = true;
        }
        this.cooldownRemaining = this.cooldown;
    }

    /**
     * ラウンド終了時のクールダウン処理
     */
    onRoundEnd() {
        if (this.cooldownRemaining > 0) {
            this.cooldownRemaining--;
        }
    }

    // ===== フックメソッド（サブクラスでオーバーライド） =====

    /**
     * ラウンド開始時に呼ばれる
     * @param {SkillContext} ctx - コンテキスト
     * @returns {RoundStartResult}
     */
    onRoundStart(ctx) {
        return { modified: false };
    }

    /**
     * ダイスを振る前に呼ばれる
     * @param {SkillContext} ctx - コンテキスト
     * @returns {BeforeRollResult}
     */
    beforeRoll(ctx) {
        return {
            override: false,
            dice: null,
            rerollCount: 0
        };
    }

    /**
     * ダイスを振った後に呼ばれる
     * @param {SkillContext} ctx - コンテキスト
     * @param {number[]} diceResult - ダイスの出目
     * @returns {AfterRollResult | AsyncAfterRollResult}
     */
    afterRoll(ctx, diceResult) {
        return {
            modified: false,
            newDice: diceResult
        };
    }

    /**
     * 結果計算時に呼ばれる
     * @param {SkillContext} ctx - コンテキスト
     * @param {Object} result - 勝敗結果
     * @returns {ResultCalculationResult}
     */
    onResultCalculation(ctx, result) {
        return {
            modified: false,
            multiplier: 1.0,
            bonusChips: 0
        };
    }

    /**
     * 割り込み可能なタイミングで呼ばれる
     * @param {SkillContext} ctx - コンテキスト
     * @param {Object} trigger - トリガー情報
     * @returns {InterruptResult}
     */
    onInterrupt(ctx, trigger) {
        return {
            shouldInterrupt: false,
            action: null
        };
    }

    // ===== ユーティリティメソッド =====

    /**
     * スキル情報をJSON形式で返す（クライアント送信用）
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            isUsed: this.isUsed,
            isPassive: this.isPassive,
            cooldownRemaining: this.cooldownRemaining,
            canUse: this.canUse()
        };
    }

    /**
     * スキルの状態をリセット
     */
    reset() {
        this.isUsed = false;
        this.useCount = 0;
        this.cooldownRemaining = 0;
    }
}

// ===== 型定義（JSDoc） =====

/**
 * @typedef {Object} SkillContext
 * @property {Object} room - ゲームルーム
 * @property {Object} player - スキル所有者
 * @property {number} round - 現在のラウンド
 * @property {boolean} [isDealer] - 親かどうか
 * @property {Object} [opponent] - 対戦相手（結果計算時）
 */

/**
 * @typedef {Object} RoundStartResult
 * @property {boolean} modified - 何か変更があったか
 * @property {string} [message] - 表示メッセージ
 */

/**
 * @typedef {Object} BeforeRollResult
 * @property {boolean} override - ダイスを固定するか
 * @property {number[]|null} dice - 固定するダイスの出目
 * @property {number} rerollCount - 追加の振り直し回数
 */

/**
 * @typedef {Object} AfterRollResult
 * @property {boolean} modified - ダイスを書き換えたか
 * @property {number[]} newDice - 新しいダイスの出目
 */

/**
 * @typedef {Object} AsyncAfterRollResult
 * @property {boolean} requiresAction - ユーザー入力が必要か
 * @property {AsyncActionType} actionType - アクションの種類
 * @property {Object} actionData - アクションに必要なデータ
 * @property {Function} resolve - アクション完了時のコールバック
 */

/**
 * @typedef {Object} ResultCalculationResult
 * @property {boolean} modified - 結果を変更したか
 * @property {number} multiplier - 配当倍率の変更
 * @property {number} bonusChips - 追加チップ
 */

/**
 * @typedef {Object} InterruptResult
 * @property {boolean} shouldInterrupt - 割り込むか
 * @property {string|null} action - アクションの種類
 * @property {Object} [data] - アクションデータ
 */
