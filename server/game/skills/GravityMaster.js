/**
 * GravityMaster - 重力使いスキル
 * 
 * 非同期アクションを必要とするスキルの実装例。
 * ダイスを振った後、出目を見てから振り直すかどうかを選択できる。
 */

import { BaseSkill, AsyncActionType } from './BaseSkill.js';

export class GravityMaster extends BaseSkill {
    constructor() {
        super();
        this.id = 'gravity_master';
        this.name = '重力使い';
        this.description = '1回だけ、ダイスを振った後に出目を見てから振り直すかどうかを選べる。';
        this.isCheat = false;  // 正当なスキル
        this.maxUses = 1;
    }

    /**
     * ダイスを振った後に発動（非同期アクション）
     * @param {SkillContext} ctx 
     * @param {number[]} diceResult - 現在の出目
     * @returns {AsyncAfterRollResult}
     */
    afterRoll(ctx, diceResult) {
        // 使用済みなら何もしない
        if (!this.canUse()) {
            return {
                modified: false,
                newDice: diceResult
            };
        }

        // 非同期アクションを要求
        // GameRoomはこのレスポンスを受け取ると WAITING_FOR_ACTION 状態に移行
        return {
            requiresAction: true,
            actionType: AsyncActionType.REROLL_DECISION,
            actionData: {
                skillId: this.id,
                skillName: this.name,
                currentDice: diceResult,
                prompt: '現在の出目を見てください。振り直しますか？',
                options: [
                    { id: 'keep', label: 'このまま', description: '現在の出目で勝負する' },
                    { id: 'reroll', label: '振り直す', description: 'ダイスを振り直す' }
                ],
                timeoutSeconds: 15  // 15秒以内に選択
            },
            // この関数はプレイヤーの選択後にGameRoomから呼ばれる
            resolve: (choice, newRoll) => {
                if (choice === 'reroll') {
                    this.markUsed();
                    return {
                        modified: true,
                        newDice: newRoll,
                        effectData: {
                            type: 'GRAVITY_REROLL',
                            previousDice: diceResult
                        }
                    };
                }
                // keepの場合もスキル消費
                this.markUsed();
                return {
                    modified: false,
                    newDice: diceResult
                };
            }
        };
    }
}

export default GravityMaster;
