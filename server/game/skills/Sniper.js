/**
 * Sniper - スナイパースキル
 * 
 * インタラクティブスキル: 相手のダイス1つを強制的に「1」に変える。
 */

import { BaseSkill, AsyncActionType } from './BaseSkill.js';

export class Sniper extends BaseSkill {
    constructor() {
        super();
        this.id = 'sniper';
        this.name = 'スナイパー';
        this.description = '相手のダイス1つを狙い撃ちして「1」に変える。';
        this.isCheat = false;
        this.maxUses = 1;
    }

    /**
     * 相手がダイスを振った後に発動（割り込み）
     */
    onInterrupt(ctx, trigger) {
        if (!this.canUse()) {
            return { shouldInterrupt: false, action: null };
        }

        // ダイスロール完了後のみ発動可能
        if (trigger.type !== 'ROLL_COMPLETE') {
            return { shouldInterrupt: false, action: null };
        }

        // 自分のロール時は対象外
        if (trigger.targetPlayer.id === ctx.player.id) {
            return { shouldInterrupt: false, action: null };
        }

        const targetPlayer = trigger.targetPlayer;
        const targetDice = targetPlayer.currentDice;

        return {
            shouldInterrupt: true,
            requiresAction: true,
            actionType: AsyncActionType.TARGET_DICE_SELECT,
            actionData: {
                skillId: this.id,
                skillName: this.name,
                prompt: `${targetPlayer.name}のダイスを1つ選んで「1」に変えます`,
                targetPlayerId: targetPlayer.id,
                targetPlayerName: targetPlayer.name,
                dice: targetDice,
                options: targetDice.map((value, index) => ({
                    id: index,
                    label: `ダイス${index + 1}: ${value}`,
                    value: value
                })),
                timeoutSeconds: 10
            },
            resolve: (diceIndex) => {
                this.markUsed();

                // 選択されたダイスを「1」に変更
                const newDice = [...targetDice];
                const oldValue = newDice[diceIndex];
                newDice[diceIndex] = 1;

                return {
                    action: 'MODIFY_OPPONENT_DICE',
                    targetPlayerId: targetPlayer.id,
                    newDice: newDice,
                    effectData: {
                        type: 'SNIPER_EFFECT',
                        message: `スナイパー発動！${targetPlayer.name}のダイス${diceIndex + 1}を${oldValue}→1に！`,
                        intensity: 'HIGH',
                        targetDiceIndex: diceIndex
                    }
                };
            }
        };
    }

    // afterRollでも発動可能にする（自分のターン後に相手を狙う場合）
    afterRoll(ctx, diceResult) {
        if (!this.canUse()) {
            return { modified: false, newDice: diceResult };
        }

        const { room, player } = ctx;

        // 自分が子で親を狙う場合
        const dealer = room.getDealer();
        if (!dealer || dealer.id === player.id || !dealer.currentDice) {
            return { modified: false, newDice: diceResult };
        }

        return {
            modified: false,
            newDice: diceResult,
            requiresAction: true,
            actionType: AsyncActionType.TARGET_DICE_SELECT,
            actionData: {
                skillId: this.id,
                skillName: this.name,
                prompt: `${dealer.name}（親）のダイスを1つ選んで「1」に変えますか？`,
                targetPlayerId: dealer.id,
                targetPlayerName: dealer.name,
                dice: dealer.currentDice,
                options: [
                    { id: 'skip', label: 'スキップ', description: 'スキルを使わない' },
                    ...dealer.currentDice.map((value, index) => ({
                        id: index,
                        label: `ダイス${index + 1}: ${value}`,
                        value: value
                    }))
                ],
                timeoutSeconds: 10
            },
            resolve: (choice) => {
                if (choice === 'skip') {
                    return { modified: false, newDice: diceResult };
                }

                this.markUsed();
                const diceIndex = parseInt(choice);
                const newDealerDice = [...dealer.currentDice];
                const oldValue = newDealerDice[diceIndex];
                newDealerDice[diceIndex] = 1;

                return {
                    modified: false,
                    newDice: diceResult,
                    modifyOpponent: {
                        targetPlayerId: dealer.id,
                        newDice: newDealerDice
                    },
                    effectData: {
                        type: 'SNIPER_EFFECT',
                        message: `スナイパー発動！${dealer.name}のダイス${diceIndex + 1}を${oldValue}→1に！`,
                        intensity: 'HIGH'
                    }
                };
            }
        };
    }
}

export default Sniper;
