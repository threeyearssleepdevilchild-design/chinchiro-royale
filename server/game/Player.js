/**
 * Player - プレイヤークラス
 * 
 * プレイヤーの情報と接続状態を管理。
 * Socket接続とユーザー情報を紐付け、公開情報のフィルタリングを行う。
 */

import { BaseSkill } from './skills/BaseSkill.js';

export class Player {
    /**
     * @param {string} id - プレイヤーID（通常はSocket ID）
     * @param {string} name - 表示名
     * @param {string} socketId - Socket.io接続ID
     */
    constructor(id, name, socketId) {
        /** @type {string} プレイヤーID */
        this.id = id;

        /** @type {string} 表示名 */
        this.name = name;

        /** @type {string} Socket.io接続ID */
        this.socketId = socketId;

        /** @type {number} 所持チップ */
        this.chips = 1000;

        /** @type {BaseSkill|null} 所持スキル */
        this.skill = null;

        /** @type {number} 現在のベット額 */
        this.currentBet = 0;

        /** @type {number[]} 現在のダイス出目 */
        this.currentDice = [];

        /** @type {Object|null} 現在の役判定結果 */
        this.currentHand = null;

        /** @type {boolean} 親かどうか */
        this.isDealer = false;

        /** @type {boolean} 接続中かどうか */
        this.isConnected = true;

        /** @type {boolean} 現在のラウンドでロール済みか */
        this.hasRolled = false;

        /** @type {number} 目なし時の振り直し回数 */
        this.rerollCount = 0;

        /** @type {number} ゲーム中の順位（終了時に設定） */
        this.rank = 0;

        /** @type {string|null} チームID（チーム戦時） */
        this.teamId = null;
    }

    // ===== チップ管理 =====

    /**
     * チップを追加
     * @param {number} amount 
     */
    addChips(amount) {
        this.chips += amount;
    }

    /**
     * チップを減らす（マイナスも許可）
     * @param {number} amount 
     * @returns {boolean} 常にtrue（マイナスも許可）
     */
    removeChips(amount) {
        this.chips -= amount;
        return true;
    }

    /**
     * ベットを置く
     * @param {number} amount 
     * @returns {boolean} ベットできたかどうか
     */
    placeBet(amount) {
        // 最低額(1000)なら所持金不足でも許可（借金）
        if (amount > this.chips && amount !== 1000) {
            return false;
        }
        this.currentBet = amount;
        return true;
    }

    /**
     * 破産しているかチェック
     * @returns {boolean}
     */
    isBankrupt() {
        return this.chips <= 0;
    }

    // ===== スキル管理 =====

    /**
     * スキルを設定
     * @param {BaseSkill} skill 
     */
    setSkill(skill) {
        this.skill = skill;
    }

    /**
     * スキルが使用可能かチェック
     * @returns {boolean}
     */
    canUseSkill() {
        return this.skill && this.skill.canUse();
    }

    // ===== ラウンド管理 =====

    /**
     * ラウンド開始時のリセット
     */
    resetForRound() {
        this.currentBet = 0;
        this.currentDice = [];
        this.currentHand = null;
        this.hasRolled = false;
        this.rerollCount = 0;
    }

    /**
     * ゲーム開始時のリセット
     * @param {number} initialChips 
     */
    resetForGame(initialChips = 1000) {
        this.chips = initialChips;
        this.skill = null;
        this.isDealer = false;
        this.rank = 0;
        this.resetForRound();
    }

    // ===== 接続管理 =====

    /**
     * 再接続時の処理
     * @param {string} newSocketId 
     */
    reconnect(newSocketId) {
        this.socketId = newSocketId;
        this.isConnected = true;
    }

    /**
     * 切断時の処理
     */
    disconnect() {
        this.isConnected = false;
    }

    // ===== シリアライズ =====

    /**
     * 公開情報をJSON形式で返す（他プレイヤーに送信用）
     * @returns {Object}
     */
    toPublicJSON() {
        return {
            id: this.id,
            name: this.name,
            chips: this.chips,
            currentBet: this.currentBet,
            currentDice: this.currentDice,
            currentHand: this.currentHand ? {
                type: this.currentHand.type,
                displayName: this.currentHand.displayName
            } : null,
            isDealer: this.isDealer,
            isConnected: this.isConnected,
            hasRolled: this.hasRolled,
            // スキル名は公開（能力詳細は非公開）
            skillName: this.skill ? this.skill.name : null,
            skillUsed: this.skill ? this.skill.isUsed : false,
            teamId: this.teamId
        };
    }

    /**
     * 自分自身用のJSON（スキル詳細を含む）
     * @returns {Object}
     */
    toPrivateJSON() {
        return {
            ...this.toPublicJSON(),
            skill: this.skill ? this.skill.toJSON() : null
        };
    }

    /**
     * サーバー内部用の完全なJSON
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            socketId: this.socketId,
            chips: this.chips,
            skill: this.skill,
            currentBet: this.currentBet,
            currentDice: this.currentDice,
            currentHand: this.currentHand,
            isDealer: this.isDealer,
            isConnected: this.isConnected,
            hasRolled: this.hasRolled,
            rerollCount: this.rerollCount,
            rank: this.rank,
            teamId: this.teamId
        };
    }
}

export default Player;
