/**
 * Bomber - 道連れスキル
 * 
 * パッシブスキル: ヒフミで負けた時、他プレイヤー全員のチップをベット額分減らす。
 */

import { BaseSkill } from './BaseSkill.js';
import { HandType } from '../DiceEngine.js';

export class Bomber extends BaseSkill {
    constructor() {
        super();
        this.id = 'bomber';
        this.name = '道連れ';
        this.description = '【パッシブ】ヒフミで負けた時、他全員のチップをベット額分奪う。';
        this.isCheat = false;
        this.isPassive = true;
        this.maxUses = -1;
    }

    /**
     * 結果計算時に道連れ効果発動
     */
    onResultCalculation(ctx, result) {
        const { room, player } = ctx;

        // ヒフミで負けた場合のみ発動
        if (player.currentHand && player.currentHand.type === HandType.HIFUMI) {
            const betAmount = player.currentBet || 100; // ベット額（親の場合はデフォルト100）
            const otherPlayers = room.getPlayersArray().filter(p => p.id !== player.id);

            // 全員のチップを減らす
            let totalStolen = 0;
            otherPlayers.forEach(p => {
                const steal = Math.min(p.chips, betAmount);
                p.removeChips(steal);
                totalStolen += steal;
            });

            // 自分も含めて全員にダメージ（本当の道連れ）
            return {
                modified: true,
                multiplier: 1.0,
                bonusChips: 0,
                sideEffect: {
                    type: 'BOMBER_EXPLOSION',
                    affectedPlayers: otherPlayers.map(p => p.id),
                    damagePerPlayer: betAmount,
                    totalDamage: totalStolen
                },
                effectData: {
                    type: 'BOMBER_EFFECT',
                    message: `道連れ発動！全員に${betAmount}ダメージ！`,
                    intensity: 'MAXIMUM'
                }
            };
        }

        return { modified: false, multiplier: 1.0, bonusChips: 0 };
    }
}

export default Bomber;
