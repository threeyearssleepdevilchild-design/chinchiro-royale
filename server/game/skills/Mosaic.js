/**
 * Mosaic - モザイクスキル
 * 
 * ビジュアル妨害: 指定したプレイヤーの画面にぼかし効果を適用。
 */

import { BaseSkill, AsyncActionType } from './BaseSkill.js';

export class Mosaic extends BaseSkill {
    constructor() {
        super();
        this.id = 'mosaic';
        this.name = 'モザイク';
        this.description = '相手の画面にモザイクをかけて出目を見にくくする。';
        this.isCheat = false;
        this.maxUses = 1;
    }

    /**
     * ダイスを振る前に発動（ターゲット選択）
     */
    beforeRoll(ctx) {
        if (!this.canUse()) {
            return { override: false, dice: null, rerollCount: 0 };
        }

        const { room, player } = ctx;
        const otherPlayers = room.getPlayersArray()
            .filter(p => p.id !== player.id)
            .map(p => ({ id: p.id, name: p.name }));

        // 非同期アクション: ターゲット選択
        return {
            override: false,
            requiresAction: true,
            actionType: AsyncActionType.TARGET_SELECT,
            actionData: {
                skillId: this.id,
                skillName: this.name,
                prompt: 'モザイクをかける対象を選んでください',
                targets: [
                    { id: 'all', name: '全員' },
                    ...otherPlayers
                ],
                timeoutSeconds: 10
            },
            resolve: (targetId) => {
                this.markUsed();

                // 対象プレイヤーにビジュアル効果を適用
                const targetIds = targetId === 'all'
                    ? otherPlayers.map(p => p.id)
                    : [targetId];

                return {
                    override: false,
                    dice: null,
                    visualEffect: {
                        type: 'MOSAIC',
                        targetPlayerIds: targetIds,
                        duration: 15000, // 15秒間
                        cssClass: 'blur-effect'
                    },
                    effectData: {
                        type: 'MOSAIC_EFFECT',
                        message: 'モザイク発動！画面がぼやける！'
                    }
                };
            }
        };
    }
}

export default Mosaic;
