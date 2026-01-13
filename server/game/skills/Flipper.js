/**
 * Flipper - 裏返す者スキル
 * 
 * インタラクティブスキル: 自分のダイス1つを裏の数字（7-n）に変える。
 * 例: 1→6, 2→5, 3→4, 4→3, 5→2, 6→1
 */

import { BaseSkill, AsyncActionType } from './BaseSkill.js';

export class Flipper extends BaseSkill {
    constructor() {
        super();
        this.id = 'flipper';
        this.name = '裏返す者';
        this.description = '自分のダイス1つを裏面の数字（7-n）に変える。';
        this.isCheat = false;
        this.maxUses = 1;
    }

    /**
     * ダイスを振った後に発動
     */
    afterRoll(ctx, diceResult) {
        if (!this.canUse()) {
            return { modified: false, newDice: diceResult };
        }

        // 裏返した場合の値を計算
        const flippedOptions = diceResult.map((value, index) => ({
            id: index,
            label: `ダイス${index + 1}: ${value} → ${7 - value}`,
            currentValue: value,
            flippedValue: 7 - value
        }));

        return {
            modified: false,
            newDice: diceResult,
            requiresAction: true,
            actionType: AsyncActionType.DICE_SELECT,
            actionData: {
                skillId: this.id,
                skillName: this.name,
                prompt: '裏返すダイスを選んでください',
                dice: diceResult,
                options: [
                    { id: 'skip', label: 'スキップ', description: 'スキルを使わない' },
                    ...flippedOptions
                ],
                timeoutSeconds: 10
            },
            resolve: (choice) => {
                if (choice === 'skip') {
                    return { modified: false, newDice: diceResult };
                }

                this.markUsed();
                const diceIndex = parseInt(choice);
                const newDice = [...diceResult];
                const oldValue = newDice[diceIndex];
                newDice[diceIndex] = 7 - oldValue;

                return {
                    modified: true,
                    newDice: newDice,
                    effectData: {
                        type: 'FLIPPER_EFFECT',
                        message: `裏返し発動！ダイス${diceIndex + 1}を${oldValue}→${7 - oldValue}に！`,
                        intensity: 'MEDIUM',
                        flippedIndex: diceIndex
                    }
                };
            }
        };
    }
}

export default Flipper;
