/**
 * FourthDimension - 四次元の使い手スキル
 * 
 * インタラクティブスキル: ダイスを4つ振り、その中から3つを選ぶ。
 */

import { BaseSkill, AsyncActionType } from './BaseSkill.js';
import { DiceEngine } from '../DiceEngine.js';

export class FourthDimension extends BaseSkill {
    constructor() {
        super();
        this.id = 'fourth_dimension';
        this.name = '四次元の使い手';
        this.description = 'ダイスを4つ振り、好きな3つを選んで役にする。';
        this.isCheat = false;
        this.maxUses = 1;
    }

    /**
     * ダイスを振る前に発動（4つ振る）
     */
    beforeRoll(ctx) {
        if (!this.canUse()) {
            return { override: false, dice: null, rerollCount: 0 };
        }

        // 4つのダイスを振る
        const fourDice = DiceEngine.roll(4);

        return {
            override: true,
            requiresAction: true,
            actionType: AsyncActionType.DICE_SELECT_MULTI,
            actionData: {
                skillId: this.id,
                skillName: this.name,
                prompt: '4つのダイスから3つを選んでください',
                dice: fourDice,
                selectCount: 3,
                options: fourDice.map((value, index) => ({
                    id: index,
                    label: `ダイス${index + 1}`,
                    value: value
                })),
                timeoutSeconds: 15
            },
            resolve: (selectedIndices) => {
                this.markUsed();

                // 選択されたインデックスから3つのダイスを取得
                let finalDice;
                if (Array.isArray(selectedIndices) && selectedIndices.length === 3) {
                    finalDice = selectedIndices.map(i => fourDice[i]);
                } else {
                    // タイムアウトなどで選択されなかった場合、最初の3つを使用
                    finalDice = fourDice.slice(0, 3);
                }

                return {
                    override: true,
                    dice: finalDice,
                    effectData: {
                        type: 'FOURTH_DIMENSION_EFFECT',
                        message: '四次元発動！4つの中から3つを選択！',
                        allDice: fourDice,
                        selectedDice: finalDice,
                        intensity: 'MEDIUM'
                    }
                };
            }
        };
    }
}

export default FourthDimension;
