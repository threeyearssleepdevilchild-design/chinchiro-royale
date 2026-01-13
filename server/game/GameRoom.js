/**
 * GameRoom - ゲームルームクラス（ステートマシン）
 * 
 * ゲームの進行を管理する心臓部。
 * 非同期スキル処理、ダウト受付ウィンドウ、ターン進行を制御。
 */

import { v4 as uuidv4 } from 'uuid';
import { DiceEngine, HandType } from './DiceEngine.js';
import { CheatTracker } from './CheatTracker.js';
import { SkillRegistry } from './skills/SkillRegistry.js';
import { GameState, GameConfig, GameEvent, isValidTransition } from './GameState.js';
import { Player } from './Player.js';

export class GameRoom {
    /**
     * @param {string} hostId - ホストプレイヤーのID
     * @param {Object} io - Socket.ioサーバーインスタンス
     */
    constructor(hostId, io) {
        /** @type {string} ルームID (3桁の数字) */
        this.id = String(Math.floor(100 + Math.random() * 900));

        /** @type {Object} Socket.ioインスタンス */
        this.io = io;

        /** @type {string} ホストプレイヤーID */
        this.hostId = hostId;

        /** @type {Map<string, Player>} プレイヤー一覧 */
        this.players = new Map();

        /** @type {GameState} 現在のゲーム状態 */
        this.state = GameState.WAITING;

        /** @type {number} 現在のラウンド番号 */
        this.roundNumber = 0;

        /** @type {string|null} 現在の親プレイヤーID */
        this.currentDealerId = null;

        /** @type {string|null} 現在ロール中の子プレイヤーID */
        this.currentPlayerId = null;

        /** @type {number} 親の順番インデックス */
        this.dealerIndex = 0;

        /** @type {SkillRegistry} スキル登録 */
        this.skillRegistry = new SkillRegistry();

        /** @type {CheatTracker} イカサマ追跡 */
        this.cheatTracker = new CheatTracker();

        /** @type {number|null} 割り込みウィンドウのタイマーID */
        this.interruptTimer = null;

        /** @type {number|null} アクション待ちタイマーID */
        this.actionTimer = null;

        /** @type {Object|null} 保留中の非同期アクション */
        this.pendingAction = null;

        /** @type {Array} プレイヤー順序（ロール順） */
        this.playerOrder = [];

        /** @type {number} 現在の子プレイヤーインデックス */
        this.currentPlayerIndex = 0;

        /** @type {Object} ラウンド結果 */
        this.roundResults = [];

        /** @type {number} 現在のセット番号（親1巡が1セット） */
        this.currentSet = 1;

        /** @type {number} セット開始時の親インデックス */
        this.setStartDealerIndex = 0;

        /** @type {Date} ルーム作成日時 */
        this.createdAt = new Date();
    }

    // ===== プレイヤー管理 =====

    /**
     * プレイヤーを追加
     * @param {Player} player 
     * @returns {boolean}
     */
    addPlayer(player) {
        if (this.players.size >= GameConfig.MAX_PLAYERS) {
            return false;
        }
        if (this.state !== GameState.WAITING) {
            return false;
        }

        this.players.set(player.id, player);
        this.broadcast(GameEvent.PLAYER_JOINED, {
            player: player.toPublicJSON(),
            playerCount: this.players.size
        });

        return true;
    }

    /**
     * プレイヤーを削除
     * @param {string} playerId 
     */
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;

        this.players.delete(playerId);

        // ホストが抜けた場合、次のプレイヤーをホストに
        if (playerId === this.hostId && this.players.size > 0) {
            this.hostId = this.players.keys().next().value;
        }

        this.broadcast(GameEvent.PLAYER_LEFT, {
            playerId,
            newHostId: this.hostId,
            playerCount: this.players.size
        });
    }

    /**
     * プレイヤーを取得
     * @param {string} playerId 
     * @returns {Player|undefined}
     */
    getPlayer(playerId) {
        return this.players.get(playerId);
    }

    /**
     * 全プレイヤーを配列で取得
     * @returns {Player[]}
     */
    getPlayersArray() {
        return Array.from(this.players.values());
    }

    /**
     * 親プレイヤーを取得
     * @returns {Player|undefined}
     */
    getDealer() {
        return this.players.get(this.currentDealerId);
    }

    /**
     * 子プレイヤー一覧を取得
     * @returns {Player[]}
     */
    getNonDealers() {
        return this.getPlayersArray().filter(p => p.id !== this.currentDealerId);
    }

    // ===== ゲーム進行 =====

    /**
     * ゲーム開始
     * @returns {boolean}
     */
    startGame() {
        if (this.players.size < GameConfig.MIN_PLAYERS) {
            return false;
        }
        if (this.state !== GameState.WAITING) {
            return false;
        }

        // プレイヤー順序を決定
        this.playerOrder = this.getPlayersArray().map(p => p.id);
        this.shuffleArray(this.playerOrder);

        // 全プレイヤーをリセット
        this.players.forEach(player => {
            player.resetForGame(GameConfig.INITIAL_CHIPS);
        });

        // スキル配布フェーズへ
        this.changeState(GameState.SKILL_DISTRIBUTION);
        this.distributeSkills();

        return true;
    }

    /**
     * スキルを配布（現在は無効化）
     */
    distributeSkills() {
        // スキルなしモード: スキル配布をスキップ
        // TODO: スキル有りモードを実装する場合はここを復活
        /*
        const skills = this.skillRegistry.getRandomSkills(
            this.players.size,
            { allowDuplicates: false }
        );

        let index = 0;
        this.players.forEach(player => {
            const skill = skills[index++];
            player.setSkill(skill);

            this.emitToPlayer(player.id, GameEvent.SKILL_ASSIGNED, {
                skill: skill.toJSON()
            });
        });
        */

        // 全員への通知
        this.broadcast(GameEvent.GAME_STARTED, {
            playerOrder: this.playerOrder,
            players: this.getPublicPlayersData()
        });

        // 次のフェーズへ
        this.startNewRound();
    }

    /**
     * 新しいラウンドを開始
     */
    startNewRound() {
        this.roundNumber++;
        this.cheatTracker.startRound(this.roundNumber);
        this.roundResults = [];

        // 親を決定
        this.currentDealerId = this.playerOrder[this.dealerIndex];
        const dealer = this.getDealer();
        dealer.isDealer = true;

        // 全プレイヤーをラウンド用にリセット
        this.players.forEach(player => {
            player.resetForRound();
            if (player.id === this.currentDealerId) {
                player.isDealer = true;
            }
        });

        // スキルのラウンド開始フック
        this.players.forEach(player => {
            if (player.skill) {
                const result = player.skill.onRoundStart({
                    room: this,
                    player,
                    round: this.roundNumber
                });
                if (result.message) {
                    this.emitToPlayer(player.id, 'skill_effect', { message: result.message });
                }
            }
        });

        // ベッティングフェーズへ
        this.changeState(GameState.BETTING);
        this.broadcast('round_started', {
            roundNumber: this.roundNumber,
            dealerId: this.currentDealerId,
            players: this.getPublicPlayersData()
        });
    }

    /**
     * ベットを受け付ける
     * @param {string} playerId 
     * @param {number} amount 
     * @returns {boolean}
     */
    placeBet(playerId, amount) {
        if (this.state !== GameState.BETTING) return false;

        const player = this.getPlayer(playerId);
        if (!player) return false;

        // 親はベットしない（通常のチンチロルール）
        if (player.isDealer) {
            return false;
        }

        if (amount < GameConfig.MIN_BET || amount > GameConfig.MAX_BET) {
            return false;
        }

        if (!player.placeBet(amount)) {
            return false;
        }

        // 残りベット待ちプレイヤー数（子のみ対象）
        const nonDealers = this.getNonDealers();
        const remainingCount = nonDealers.filter(p => p.currentBet === 0).length;

        this.broadcast('bet_placed', {
            playerId,
            amount,
            remainingPlayers: remainingCount
        });

        // 子全員がベットしたか確認
        const allNonDealersBetted = nonDealers.every(p => p.currentBet > 0);
        if (allNonDealersBetted) {
            // ★変更: 子が先にロール、親は最後
            this.startPlayerRolls();
        }

        return true;
    }

    /**
     * 子プレイヤーのロール開始（子→親の順番）
     */
    startPlayerRolls() {
        this.changeState(GameState.PLAYER_ROLL);
        this.currentPlayerIndex = 0;

        const nonDealers = this.getNonDealers();
        if (nonDealers.length === 0) {
            // 子がいない場合は親のロールへ
            this.startDealerRoll();
            return;
        }

        this.currentPlayerId = nonDealers[0].id;
        this.broadcast('player_turn', {
            playerId: this.currentPlayerId,
            playerIndex: 0,
            totalPlayers: nonDealers.length
        });
    }

    /**
     * 親のダイスロール開始
     */
    startDealerRoll() {
        this.changeState(GameState.DEALER_ROLL);
        this.broadcast('dealer_turn', {
            dealerId: this.currentDealerId
        });
    }

    /**
     * ダイスを振る処理
     * @param {string} playerId 
     * @returns {Object}
     */
    async rollDice(playerId) {
        const player = this.getPlayer(playerId);
        if (!player) return { success: false, error: 'プレイヤーが見つかりません' };

        // 振り直し中かどうかをチェック
        const isRerolling = player.isWaitingForReroll === true;

        // 状態チェック（振り直し中プレイヤーは許可）
        if (!isRerolling) {
            if (this.state === GameState.DEALER_ROLL && playerId !== this.currentDealerId) {
                return { success: false, error: '親のターンです' };
            }
            if (this.state === GameState.PLAYER_ROLL && playerId !== this.currentPlayerId) {
                return { success: false, error: 'あなたのターンではありません' };
            }
            // DEALER_ROLLでもPLAYER_ROLLでもない場合はエラー
            if (this.state !== GameState.DEALER_ROLL && this.state !== GameState.PLAYER_ROLL) {
                return { success: false, error: '現在はダイスを振れません' };
            }
        } else {
            // 振り直しフラグを解除
            player.isWaitingForReroll = false;
        }

        // スキルの beforeRoll フック
        let diceResult;
        let effectData = null;

        if (player.skill) {
            const beforeResult = player.skill.beforeRoll({
                room: this,
                player,
                isDealer: player.isDealer
            });

            if (beforeResult.override && beforeResult.dice) {
                diceResult = beforeResult.dice;
                effectData = beforeResult.effectData || null;
            } else {
                diceResult = DiceEngine.roll();
            }
        } else {
            diceResult = DiceEngine.roll();
        }


        // スキルの afterRoll フック
        if (player.skill) {
            const afterResult = player.skill.afterRoll(
                { room: this, player },
                diceResult
            );

            // 非同期アクションが必要な場合
            if (afterResult.requiresAction) {
                return await this.handleAsyncSkillAction(player, afterResult, diceResult);
            }

            if (afterResult.modified) {
                diceResult = afterResult.newDice;
                effectData = afterResult.effectData || effectData;
            }
        }

        // ダイス結果を確定
        return this.finalizeRoll(player, diceResult, effectData);
    }

    /**
     * 非同期スキルアクションを処理
     * @param {Player} player 
     * @param {Object} skillResult 
     * @param {number[]} originalDice 
     */
    async handleAsyncSkillAction(player, skillResult, originalDice) {
        // WAITING_FOR_ACTION 状態に遷移
        this.changeState(GameState.WAITING_FOR_ACTION);

        // 保留アクションを保存
        this.pendingAction = {
            playerId: player.id,
            skillResult,
            originalDice,
            resolve: skillResult.resolve
        };

        // クライアントに選択を求める
        this.emitToPlayer(player.id, GameEvent.WAITING_FOR_ACTION, {
            actionType: skillResult.actionType,
            actionData: skillResult.actionData
        });

        // 他プレイヤーには待機中であることを通知
        this.broadcastExcept(player.id, 'player_deciding', {
            playerId: player.id,
            skillName: player.skill.name
        });

        // タイムアウト設定
        this.actionTimer = setTimeout(() => {
            this.handleSkillActionTimeout(player.id);
        }, GameConfig.ACTION_TIMEOUT_MS);

        return { success: true, waiting: true };
    }

    /**
     * スキルアクションのレスポンスを処理（クライアントからの応答）
     * @param {string} playerId 
     * @param {Object} response - { choice: 'keep' | 'reroll', ... }
     */
    async handleSkillAction(playerId, response) {
        if (this.state !== GameState.WAITING_FOR_ACTION) {
            return { success: false, error: '現在アクション待ちではありません' };
        }
        if (!this.pendingAction || this.pendingAction.playerId !== playerId) {
            return { success: false, error: 'あなたのアクション待ちではありません' };
        }

        // タイマーをクリア
        if (this.actionTimer) {
            clearTimeout(this.actionTimer);
            this.actionTimer = null;
        }

        const player = this.getPlayer(playerId);
        const { resolve, originalDice, skillResult } = this.pendingAction;

        // 振り直しの場合は新しいダイスを振る
        let newDice = originalDice;
        if (response.choice === 'reroll') {
            newDice = DiceEngine.roll();
        }

        // resolve 関数を呼び出し
        const result = resolve(response.choice, newDice);

        // 保留アクションをクリア
        this.pendingAction = null;

        // modifyOpponent 処理（スナイパー、すり替え等）
        if (result.modifyOpponent) {
            this.applyOpponentDiceModification(result.modifyOpponent, result.effectData);
        }

        // ビジュアルエフェクト（モザイク等）
        if (result.visualEffect) {
            this.applyVisualEffect(result.visualEffect);
        }

        // ダイス結果を確定
        const finalDice = result.newDice || (result.override ? result.dice : originalDice);
        return this.finalizeRoll(player, finalDice, result.effectData);
    }

    /**
     * スキルアクションのタイムアウト処理
     * @param {string} playerId 
     */
    handleSkillActionTimeout(playerId) {
        if (!this.pendingAction || this.pendingAction.playerId !== playerId) {
            return;
        }

        // タイムアウト時はデフォルト選択（keep）
        this.handleSkillAction(playerId, { choice: 'keep' });
    }

    /**
     * ダイスロールを確定
     * @param {Player} player 
     * @param {number[]} dice 
     * @param {Object|null} effectData 
     */
    async finalizeRoll(player, dice, effectData) {
        player.currentDice = dice;
        player.currentHand = DiceEngine.evaluateHand(dice);
        player.hasRolled = true;

        // 目なしの場合
        if (player.currentHand.type === HandType.MENASHI) {
            player.rerollCount++;

            if (player.rerollCount >= GameConfig.MAX_REROLL_ATTEMPTS) {
                // 振り直し上限 → 自動負け
                this.broadcast(GameEvent.DICE_ROLLED, {
                    playerId: player.id,
                    dice,
                    hand: player.currentHand,
                    effectData,
                    isAutoLoss: true
                });

                // 自動負けでも次の処理へ進む（割り込みウィンドウを開始）
                this.startInterruptWindow(player);
                return { success: true, hand: player.currentHand, autoLoss: true };
            } else {
                // 振り直し可能 - ここで処理を止めてプレイヤーの入力を待つ
                player.hasRolled = false;
                player.isWaitingForReroll = true;

                this.broadcast(GameEvent.DICE_ROLLED, {
                    playerId: player.id,
                    dice,
                    hand: player.currentHand,
                    effectData,
                    canReroll: true,
                    rerollCount: player.rerollCount
                });
                // 状態はそのまま維持し、次のrollDice()を待つ
                // ※startInterruptWindowは呼ばない
                return { success: true, needsReroll: true };
            }

        }

        // 通常の結果（目なし以外）
        this.broadcast(GameEvent.DICE_ROLLED, {
            playerId: player.id,
            dice,
            hand: player.currentHand,
            effectData
        });

        // 割り込みスキルは現段階では無効化（後で実装）
        // TODO: 割り込みスキルはプレイヤーが明示的に発動を選択する形式に変更
        // const interruptResult = await this.checkInterruptSkills(player);
        // if (interruptResult.interrupted) {
        //     return { success: true, hand: player.currentHand, interrupted: true };
        // }

        // 割り込みウィンドウを開始
        this.startInterruptWindow(player);

        return { success: true, hand: player.currentHand };
    }

    /**
     * 割り込みスキルをチェック
     * @param {Player} rolledPlayer - ダイスを振ったプレイヤー
     * @returns {Object}
     */
    async checkInterruptSkills(rolledPlayer) {
        const trigger = {
            type: 'ROLL_COMPLETE',
            targetPlayer: rolledPlayer,
            dice: rolledPlayer.currentDice,
            hand: rolledPlayer.currentHand
        };

        // 他のプレイヤーの割り込みスキルをチェック
        for (const player of this.getPlayersArray()) {
            if (player.id === rolledPlayer.id) continue;
            if (!player.skill || !player.skill.onInterrupt) continue;

            const result = player.skill.onInterrupt(
                { room: this, player },
                trigger
            );

            if (result.shouldInterrupt && result.requiresAction) {
                // 割り込み発動 → handleAsyncSkillAction を使用
                await this.handleAsyncSkillAction(player, result, player.currentDice || []);
                return { interrupted: true };
            }
        }

        return { interrupted: false };
    }

    /**
     * 相手のダイスを変更（Sniper、Switch用）
     * @param {Object} modification - { targetPlayerId, newDice }
     * @param {Object|null} effectData 
     */
    applyOpponentDiceModification(modification, effectData) {
        const { targetPlayerId, newDice } = modification;
        const targetPlayer = this.getPlayer(targetPlayerId);

        if (!targetPlayer) {
            console.warn(`対象プレイヤーが見つかりません: ${targetPlayerId}`);
            return;
        }

        // ダイスと役を更新
        targetPlayer.currentDice = newDice;
        targetPlayer.currentHand = DiceEngine.evaluateHand(newDice);

        // 全員に通知
        this.broadcast('dice_updated', {
            playerId: targetPlayerId,
            newDice,
            newHand: targetPlayer.currentHand,
            effectData,
            reason: 'skill_effect'
        });
    }

    /**
     * ビジュアルエフェクトを適用（Mosaic用）
     * @param {Object} effect - { type, targetPlayerIds, duration, cssClass }
     */
    applyVisualEffect(effect) {
        const { type, targetPlayerIds, duration, cssClass } = effect;

        // 対象プレイヤーにビジュアルエフェクトを送信
        targetPlayerIds.forEach(playerId => {
            this.emitToPlayer(playerId, 'visual_effect', {
                type,
                duration,
                cssClass
            });
        });

        // 他のプレイヤーにもエフェクト発動を通知
        this.broadcast('skill_visual_effect', {
            type,
            targetPlayerIds,
            duration
        });
    }

    /**
     * 割り込みウィンドウを開始（ダウト受付）
     * @param {Player} rolledPlayer - ダイスを振ったプレイヤー
     */
    startInterruptWindow(rolledPlayer) {
        const previousState = this.state;
        this.changeState(GameState.INTERRUPT_WINDOW);

        this.broadcast('interrupt_window_open', {
            targetPlayerId: rolledPlayer.id,
            timeoutMs: GameConfig.INTERRUPT_WINDOW_MS
        });

        this.interruptTimer = setTimeout(() => {
            this.endInterruptWindow(previousState, rolledPlayer);
        }, GameConfig.INTERRUPT_WINDOW_MS);
    }

    /**
     * 割り込みウィンドウを終了
     * @param {GameState} previousState 
     * @param {Player} rolledPlayer 
     */
    endInterruptWindow(previousState, rolledPlayer) {
        if (this.interruptTimer) {
            clearTimeout(this.interruptTimer);
            this.interruptTimer = null;
        }

        this.broadcast('interrupt_window_closed', {});

        // ★変更: 子→親の順番なので
        // 子のロール後は次の子（または親）へ、親のロール後は結果計算へ
        if (rolledPlayer.isDealer) {
            // 親のロールが終わったら結果計算へ
            this.calculateResults();
        } else {
            // 子のロールが終わったら次のプレイヤー（子または親）へ
            this.nextPlayerRoll();
        }
    }

    /**
     * ダウトを処理
     * @param {string} accuserId - 告発者ID
     * @param {string} targetId - 対象ID
     */
    handleDoubt(accuserId, targetId) {
        if (this.state !== GameState.INTERRUPT_WINDOW) {
            return { success: false, error: 'ダウト受付中ではありません' };
        }

        // 割り込みタイマーをクリア
        if (this.interruptTimer) {
            clearTimeout(this.interruptTimer);
            this.interruptTimer = null;
        }

        const result = this.cheatTracker.checkDoubt(accuserId, targetId, this.roundNumber);

        const accuser = this.getPlayer(accuserId);
        const target = this.getPlayer(targetId);

        // ペナルティ適用
        if (result.caught) {
            // イカサマ発覚 → イカサマ師にペナルティ
            target.removeChips(result.penalty.chipLoss);
            accuser.addChips(Math.floor(result.penalty.chipLoss / 2)); // 報酬
        } else {
            // 冤罪 → 告発者にペナルティ
            accuser.removeChips(result.penalty.chipLoss);
        }

        this.broadcast(GameEvent.DOUBT_RESULT, {
            accuserId,
            targetId,
            result,
            accuserChips: accuser.chips,
            targetChips: target.chips
        });

        // ゲーム進行を再開
        const rolledPlayer = this.getPlayer(targetId);
        if (rolledPlayer.isDealer) {
            this.startPlayerRolls();
        } else {
            this.nextPlayerRoll();
        }

        return { success: true, result };
    }

    /**
     * 子プレイヤーのロールを開始
     */
    startPlayerRolls() {
        this.changeState(GameState.PLAYER_ROLL);
        this.currentPlayerIndex = 0;

        // 親以外のプレイヤー順序
        const nonDealers = this.playerOrder.filter(id => id !== this.currentDealerId);

        if (nonDealers.length === 0) {
            this.calculateResults();
            return;
        }

        this.currentPlayerId = nonDealers[0];
        this.broadcast('player_turn', {
            playerId: this.currentPlayerId,
            playerIndex: this.currentPlayerIndex,
            totalPlayers: nonDealers.length
        });
    }

    /**
     * 次の子プレイヤーへ
     */
    nextPlayerRoll() {
        const nonDealers = this.playerOrder.filter(id => id !== this.currentDealerId);
        this.currentPlayerIndex++;

        if (this.currentPlayerIndex >= nonDealers.length) {
            // ★子全員ロール完了 → 親のロールへ
            this.startDealerRoll();
            return;
        }

        this.currentPlayerId = nonDealers[this.currentPlayerIndex];
        this.changeState(GameState.PLAYER_ROLL);

        this.broadcast('player_turn', {
            playerId: this.currentPlayerId,
            playerIndex: this.currentPlayerIndex,
            totalPlayers: nonDealers.length
        });
    }

    /**
     * ラウンド結果を計算
     */
    calculateResults() {
        this.changeState(GameState.RESULT);

        const dealer = this.getDealer();
        const results = [];

        this.getNonDealers().forEach(player => {
            const comparison = DiceEngine.compareHands(dealer.currentHand, player.currentHand, true);

            let chipTransfer = 0;
            let multiplier = 1;

            // スキルの結果計算フック
            if (player.skill) {
                const skillResult = player.skill.onResultCalculation(
                    { room: this, player, opponent: dealer },
                    comparison
                );
                if (skillResult.modified) {
                    multiplier = skillResult.multiplier;
                }
            }
            if (dealer.skill) {
                const skillResult = dealer.skill.onResultCalculation(
                    { room: this, player: dealer, opponent: player },
                    comparison
                );
                if (skillResult.modified) {
                    multiplier *= skillResult.multiplier;
                }
            }

            // チップ移動計算
            const baseBet = player.currentBet;

            // 親と子の倍率を掛け合わせる
            const dealerMult = DiceEngine.getMultiplier(dealer.currentHand, true);
            const playerMult = DiceEngine.getMultiplier(player.currentHand, false);
            const totalMult = dealerMult * playerMult;

            if (comparison.winner === 'dealer') {
                chipTransfer = Math.floor(baseBet * totalMult * multiplier);
                player.removeChips(chipTransfer);
                dealer.addChips(chipTransfer);
            } else if (comparison.winner === 'player') {
                chipTransfer = Math.floor(baseBet * totalMult * multiplier);
                dealer.removeChips(chipTransfer);
                player.addChips(chipTransfer);
            }

            results.push({
                playerId: player.id,
                dealerId: dealer.id,
                playerHand: player.currentHand,
                dealerHand: dealer.currentHand,
                winner: comparison.winner,
                reason: comparison.reason,
                chipTransfer,
                playerChips: player.chips,
                dealerChips: dealer.chips
            });
        });

        this.roundResults = results;

        this.broadcast(GameEvent.ROUND_RESULT, {
            roundNumber: this.roundNumber,
            results,
            players: this.getPublicPlayersData()
        });

        // ラウンド終了処理
        setTimeout(() => this.endRound(), 3000);
    }

    /**
     * ラウンド終了
     */
    endRound() {
        this.changeState(GameState.ROUND_END);

        // スキルのラウンド終了処理
        this.players.forEach(player => {
            if (player.skill) {
                player.skill.onRoundEnd();
            }
            player.isDealer = false;
        });
        this.cheatTracker.onRoundEnd();

        // 破産チェック
        const bankruptPlayers = this.getPlayersArray().filter(p => p.isBankrupt());
        if (bankruptPlayers.length > 0) {
            this.broadcast('players_bankrupt', {
                playerIds: bankruptPlayers.map(p => p.id)
            });
        }

        // ゲーム終了チェック
        const activePlayers = this.getPlayersArray().filter(p => !p.isBankrupt());
        if (activePlayers.length <= 1) {
            this.endGame();
            return;
        }

        // 次の親へ
        this.dealerIndex = (this.dealerIndex + 1) % this.playerOrder.length;

        // 破産した親はスキップ
        while (this.getPlayer(this.playerOrder[this.dealerIndex]).isBankrupt()) {
            this.dealerIndex = (this.dealerIndex + 1) % this.playerOrder.length;
        }

        // ★セット終了判定: 親が1巡したらボーナス加算
        if (this.dealerIndex === this.setStartDealerIndex) {
            this.currentSet++;

            // 全員に10万点加算
            const bonusAmount = GameConfig.SET_BONUS_CHIPS;
            this.getPlayersArray().forEach(player => {
                player.addChips(bonusAmount);
            });

            this.broadcast('set_completed', {
                setNumber: this.currentSet - 1,
                bonusAmount,
                players: this.getPublicPlayersData()
            });
        }

        // 次のラウンドへ
        setTimeout(() => this.startNewRound(), 2000);
    }

    /**
     * ゲーム終了
     */
    endGame() {
        this.changeState(GameState.GAME_END);

        // ランキング計算
        const ranking = this.getPlayersArray()
            .sort((a, b) => b.chips - a.chips)
            .map((player, index) => {
                player.rank = index + 1;
                return {
                    rank: index + 1,
                    playerId: player.id,
                    name: player.name,
                    chips: player.chips
                };
            });

        this.broadcast(GameEvent.GAME_ENDED, {
            ranking,
            cheatLog: this.cheatTracker.getCheatLog()
        });
    }

    // ===== 状態管理 =====

    /**
     * 状態を変更
     * @param {GameState} newState 
     */
    changeState(newState) {
        if (!isValidTransition(this.state, newState)) {
            console.warn(`無効な状態遷移: ${this.state} → ${newState}`);
        }

        const previousState = this.state;
        this.state = newState;

        this.broadcast(GameEvent.STATE_CHANGED, {
            previousState,
            currentState: newState
        });
    }

    // ===== 通信 =====

    /**
     * ルーム全体にブロードキャスト
     * @param {string} event 
     * @param {Object} data 
     */
    broadcast(event, data) {
        this.io.to(this.id).emit(event, data);
    }

    /**
     * 特定プレイヤー以外にブロードキャスト
     * @param {string} excludePlayerId 
     * @param {string} event 
     * @param {Object} data 
     */
    broadcastExcept(excludePlayerId, event, data) {
        this.players.forEach(player => {
            if (player.id !== excludePlayerId) {
                this.io.to(player.socketId).emit(event, data);
            }
        });
    }

    /**
     * 特定プレイヤーに送信
     * @param {string} playerId 
     * @param {string} event 
     * @param {Object} data 
     */
    emitToPlayer(playerId, event, data) {
        const player = this.getPlayer(playerId);
        if (player) {
            this.io.to(player.socketId).emit(event, data);
        }
    }

    // ===== ユーティリティ =====

    /**
     * 公開用プレイヤーデータを取得
     * @returns {Object[]}
     */
    getPublicPlayersData() {
        return this.getPlayersArray().map(p => p.toPublicJSON());
    }

    /**
     * 配列をシャッフル（Fisher-Yates）
     * @param {Array} array 
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * 再戦のためにゲームをリセット
     */
    resetForRematch() {
        this.state = GameState.WAITING;
        this.roundNumber = 0;
        this.dealerIndex = 0;
        this.currentDealerId = null;
        this.currentPlayerId = null;
        this.roundResults = [];
        this.cheatTracker = new CheatTracker();

        // プレイヤーの状態をリセット（チップは初期値に戻す）
        this.players.forEach(player => {
            player.resetForGame(GameConfig.INITIAL_CHIPS);
            player.isReady = false; // 準備完了状態もリセット
        });

        // クライアントへ通知
        this.broadcast('game_reset', {
            players: this.getPublicPlayersData()
        });

        // 自動的に再ゲーム開始はせず、ロビー的な待機状態にするか、
        // すぐにstartGame()を呼ぶかは仕様次第だが、ここでは「再戦」なので即開始を試みる
        // ただし全員の準備完了を待つフローならWAITINGにする。
        // 今回はシンプルに再スタートする
        setTimeout(() => this.startGame(), 1000);
    }

    /**
     * ロビーに戻る
     */
    backToLobby() {
        this.state = GameState.WAITING;
        this.roundNumber = 0;
        this.dealerIndex = 0;
        this.currentDealerId = null;
        this.currentPlayerId = null;
        this.roundResults = [];

        this.players.forEach(player => {
            // チップ等はそのまま残るかもしれないが、再ゲーム時にリセットされるのでOK
            // 準備完了状態は解除
            player.isReady = false;
        });

        this.broadcast('returned_to_lobby', {
            players: this.getPublicPlayersData()
        });
    }

    /**
     * ルーム情報をJSON形式で返す
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this.id,
            hostId: this.hostId,
            state: this.state,
            roundNumber: this.roundNumber,
            currentDealerId: this.currentDealerId,
            currentPlayerId: this.currentPlayerId,
            playerCount: this.players.size,
            players: this.getPublicPlayersData(),
            createdAt: this.createdAt
        };
    }
}

export default GameRoom;
