/**
 * Switch - すり替えスキル
 * 
 * イカサマスキル: 相手のダイス1つと自分のダイス1つを交換する。
 */

import { BaseSkill, AsyncActionType } from './BaseSkill.js';

export class Switch extends BaseSkill {
    constructor() {
        super();
        this.id = 'switch';
        this.name = 'すり替え';
        this.description = '【イカサマ】相手のダイスと自分のダイスを1つ交換する。';
        this.isCheat = true;  // ダウト対象！
        this.maxUses = 1;
    }

    /**
     * ダイスを振った後に発動
     */
    afterRoll(ctx, diceResult) {
        if (!this.canUse()) {
            return { modified: false, newDice: diceResult };
        }

        const { room, player } = ctx;

        // 親または対戦相手を取得
        let opponent;
        if (player.isDealer) {
            // 自分が親の場合、現在ロール中の子を対象に
            const currentPlayerId = room.currentPlayerId;
            opponent = room.getPlayer(currentPlayerId);
        } else {
            // 自分が子の場合、親を対象に
            opponent = room.getDealer();
        }

        if (!opponent || !opponent.currentDice || opponent.currentDice.length === 0) {
            return { modified: false, newDice: diceResult };
        }

        return {
            modified: false,
            newDice: diceResult,
            requiresAction: true,
            actionType: AsyncActionType.SWAP_SELECT,
            actionData: {
                skillId: this.id,
                skillName: this.name,
                prompt: '交換するダイスを選んでください',
                myDice: diceResult,
                opponentDice: opponent.currentDice,
                opponentId: opponent.id,
                opponentName: opponent.name,
                // 自分のダイス選択肢
                myOptions: diceResult.map((value, index) => ({
                    id: `my_${index}`,
                    label: `自分のダイス${index + 1}: ${value}`,
                    value: value,
                    index: index
                })),
                // 相手のダイス選択肢
                opponentOptions: opponent.currentDice.map((value, index) => ({
                    id: `opp_${index}`,
                    label: `${opponent.name}のダイス${index + 1}: ${value}`,
                    value: value,
                    index: index
                })),
                timeoutSeconds: 15
            },
            resolve: (selection) => {
                // selection: { myDiceIndex: number, opponentDiceIndex: number } または 'skip'
                if (selection === 'skip' || !selection.myDiceIndex === undefined) {
                    return { modified: false, newDice: diceResult };
                }

                this.markUsed();

                const myIndex = selection.myDiceIndex;
                const oppIndex = selection.opponentDiceIndex;

                const newMyDice = [...diceResult];
                const newOppDice = [...opponent.currentDice];

                // 交換
                const temp = newMyDice[myIndex];
                newMyDice[myIndex] = newOppDice[oppIndex];
                newOppDice[oppIndex] = temp;

                // CheatTrackerに記録
                if (room.cheatTracker) {
                    room.cheatTracker.logCheat(
                        player.id,
                        this.id,
                        room.roundNumber
                    );
                }

                return {
                    modified: true,
                    newDice: newMyDice,
                    modifyOpponent: {
                        targetPlayerId: opponent.id,
                        newDice: newOppDice
                    },
                    effectData: {
                        type: 'SWITCH_EFFECT',
                        message: `すり替え発動！${opponent.name}とダイスを交換！`,
                        intensity: 'HIGH',
                        swappedIndices: { my: myIndex, opponent: oppIndex }
                    }
                };
            }
        };
    }
}

export default Switch;
