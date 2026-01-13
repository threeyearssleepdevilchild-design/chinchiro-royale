/**
 * Banker - 銀行員スキル
 * 
 * パッシブスキル: 勝った時の配当1.5倍、負けた時の支払い1.2倍。
 */

import { BaseSkill } from './BaseSkill.js';

export class Banker extends BaseSkill {
    constructor() {
        super();
        this.id = 'banker';
        this.name = '銀行員';
        this.description = '【パッシブ】勝ち配当1.5倍、負け支払い1.2倍。ハイリスク・ハイリターン。';
        this.isCheat = false;
        this.isPassive = true;
        this.maxUses = -1;
    }

    /**
     * 結果計算時に配当倍率を変更
     */
    onResultCalculation(ctx, result) {
        const { player } = ctx;

        if (result.winner === 'dealer' && player.isDealer) {
            // 自分が親で勝ち
            return {
                modified: true,
                multiplier: 1.5,
                bonusChips: 0,
                effectData: {
                    type: 'BANKER_WIN',
                    message: '銀行員ボーナス！配当1.5倍！'
                }
            };
        } else if (result.winner === 'player' && !player.isDealer) {
            // 自分が子で勝ち
            return {
                modified: true,
                multiplier: 1.5,
                bonusChips: 0,
                effectData: {
                    type: 'BANKER_WIN',
                    message: '銀行員ボーナス！配当1.5倍！'
                }
            };
        } else if (result.winner === 'dealer' && !player.isDealer) {
            // 自分が子で負け
            return {
                modified: true,
                multiplier: 1.2,
                bonusChips: 0,
                effectData: {
                    type: 'BANKER_LOSS',
                    message: '銀行員リスク...支払い1.2倍'
                }
            };
        } else if (result.winner === 'player' && player.isDealer) {
            // 自分が親で負け
            return {
                modified: true,
                multiplier: 1.2,
                bonusChips: 0,
                effectData: {
                    type: 'BANKER_LOSS',
                    message: '銀行員リスク...支払い1.2倍'
                }
            };
        }

        return { modified: false, multiplier: 1.0, bonusChips: 0 };
    }
}

export default Banker;
