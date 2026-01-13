/**
 * GodHand - GODハンドスキル
 * 
 * イカサマスキルの実装例。
 * 1回だけ必ずシゴロ（4,5,6）が出る。
 */

import { BaseSkill } from './BaseSkill.js';

export class GodHand extends BaseSkill {
    constructor() {
        super();
        this.id = 'god_hand';
        this.name = 'GODハンド';
        this.description = '【イカサマ】1回だけ、必ずシゴロ(4,5,6)が出る。ダウトされると大ダメージ。';
        this.isCheat = true;  // ダウト対象
        this.maxUses = 1;     // 1回限り
    }

    /**
     * ダイスを振る前に発動
     * @param {SkillContext} ctx 
     * @returns {BeforeRollResult}
     */
    beforeRoll(ctx) {
        // 使用済みなら何もしない
        if (!this.canUse()) {
            return { override: false, dice: null, rerollCount: 0 };
        }

        // スキル使用をマーク
        this.markUsed();

        // CheatTrackerに記録（ダウト用）
        if (ctx.room && ctx.room.cheatTracker) {
            ctx.room.cheatTracker.logCheat(
                ctx.player.id,
                this.id,
                ctx.room.roundNumber
            );
        }

        // 必ずシゴロを返す
        return {
            override: true,
            dice: [4, 5, 6],
            rerollCount: 0,
            // クライアント演出用のメタデータ
            effectData: {
                type: 'GOD_EFFECT',
                intensity: 'MAXIMUM',
                freezeDuration: 3000  // 3秒フリーズ演出
            }
        };
    }
}

export default GodHand;
