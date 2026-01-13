/**
 * Revolutionary - 革命家スキル
 * 
 * パッシブスキル: ヒフミ(1,2,3)が出たら「ピンゾロ(最強)」として扱う。
 */

import { BaseSkill } from './BaseSkill.js';
import { HandType } from '../DiceEngine.js';

export class Revolutionary extends BaseSkill {
    constructor() {
        super();
        this.id = 'revolutionary';
        this.name = '革命家';
        this.description = '【パッシブ】ヒフミが出たらピンゾロとして扱う。逆転の一手。';
        this.isCheat = false;
        this.isPassive = true;
        this.maxUses = -1; // 無制限
    }

    /**
     * ダイスを振った後、役判定を上書き
     */
    afterRoll(ctx, diceResult) {
        const sorted = [...diceResult].sort((a, b) => a - b);

        // ヒフミ判定 (1, 2, 3)
        if (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 3) {
            return {
                modified: true,
                newDice: diceResult,
                overrideHand: {
                    type: HandType.PINZORO,
                    value: 1,
                    rank: 100,
                    dice: sorted,
                    displayName: '革命ピンゾロ'
                },
                effectData: {
                    type: 'REVOLUTION_EFFECT',
                    message: '革命発動！ヒフミがピンゾロに！',
                    intensity: 'HIGH'
                }
            };
        }

        return { modified: false, newDice: diceResult };
    }
}

export default Revolutionary;
