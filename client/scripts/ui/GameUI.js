/**
 * GameUI - DOM操作とUI表示管理
 * 
 * 画面切り替え、プレイヤーリスト表示、ダイス表示、ログ管理を担当。
 */

import DiceRenderer from './DiceRenderer.js';

export class GameUI {
    constructor() {
        // 画面コンテナ
        this.screens = {
            title: document.getElementById('screen-title'),
            lobby: document.getElementById('screen-lobby'),
            game: document.getElementById('screen-game')
        };

        // タイトル画面要素
        this.titleElements = {
            playerNameInput: document.getElementById('input-player-name'),
            roomIdInput: document.getElementById('input-room-id'),
            createRoomBtn: document.getElementById('btn-create-room'),
            joinRoomBtn: document.getElementById('btn-join-room')
        };

        // ロビー画面要素
        this.lobbyElements = {
            roomIdDisplay: document.getElementById('display-room-id'),
            copyRoomIdBtn: document.getElementById('btn-copy-room-id'),
            playerList: document.getElementById('lobby-player-list'),
            playerCount: document.getElementById('player-count'),
            message: document.getElementById('lobby-message'),
            startGameBtn: document.getElementById('btn-start-game'),
            leaveRoomBtn: document.getElementById('btn-leave-room')
        };

        // ゲーム画面要素
        this.gameElements = {
            // ログ
            log: document.getElementById('game-log'),
            // 他プレイヤー
            otherPlayers: document.getElementById('other-players'),
            // ラウンド情報
            roundNumber: document.getElementById('round-number'),
            // 親エリア
            dealerName: document.getElementById('dealer-name'),
            dealerDice: document.getElementById('dealer-dice'),
            dealerHand: document.getElementById('dealer-hand'),
            // 現在プレイヤー
            currentPlayerName: document.getElementById('current-player-name'),
            currentPlayerDice: document.getElementById('current-player-dice'),
            currentPlayerHand: document.getElementById('current-player-hand'),
            // 自分の情報
            myName: document.getElementById('my-name'),
            myRoleBadge: document.getElementById('my-role-badge'),
            myChips: document.getElementById('my-chips'),
            mySkillName: document.getElementById('my-skill-name'),
            mySkillDesc: document.getElementById('my-skill-desc'),
            // コントロール
            betControls: document.getElementById('bet-controls'),
            rollControls: document.getElementById('roll-controls'),
            skillControls: document.getElementById('skill-controls'),
            doubtControls: document.getElementById('doubt-controls'),
            // ボタン
            betAmount: document.getElementById('bet-amount'),
            confirmBetBtn: document.getElementById('btn-confirm-bet'),
            rollDiceBtn: document.getElementById('btn-roll-dice'),
            useSkillBtn: document.getElementById('btn-use-skill'),
            doubtBtn: document.getElementById('btn-doubt'),
            doubtTimerBar: document.getElementById('doubt-timer-bar'),
            // モーダル
            skillActionModal: document.getElementById('skill-action-modal'),
            skillActionTitle: document.getElementById('skill-action-title'),
            skillActionPrompt: document.getElementById('skill-action-prompt'),
            skillActionOptions: document.getElementById('skill-action-options'),
            // オーバーレイ
            resultOverlay: document.getElementById('result-overlay'),
            resultTitle: document.getElementById('result-title'),
            resultDetails: document.getElementById('result-details'),
            freezeOverlay: document.getElementById('freeze-overlay')
        };

        // トースト
        this.toastContainer = document.getElementById('toast-container');

        // 現在のベット額
        this.currentBet = 0;

        // ベットボタンのイベント設定
        this.setupBetButtons();
    }

    // ===== 画面切り替え =====

    /**
     * 画面を切り替え
     * @param {string} screenId - 'title' | 'lobby' | 'game'
     */
    showScreen(screenId) {
        Object.entries(this.screens).forEach(([id, element]) => {
            if (id === screenId) {
                element.classList.add('active');
                // GSAP アニメーション
                if (window.gsap) {
                    gsap.fromTo(element,
                        { opacity: 0 },
                        { opacity: 1, duration: 0.5 }
                    );
                }
            } else {
                element.classList.remove('active');
            }
        });
    }

    // ===== ロビー画面 =====

    /**
     * ルームIDを表示
     * @param {string} roomId 
     */
    setRoomId(roomId) {
        this.lobbyElements.roomIdDisplay.textContent = roomId;
    }

    /**
     * プレイヤーリストを更新（ロビー）
     * @param {Object[]} players 
     * @param {string} hostId 
     */
    updateLobbyPlayerList(players, hostId) {
        const list = this.lobbyElements.playerList;
        list.innerHTML = '';

        players.forEach(player => {
            const li = document.createElement('li');
            li.className = 'player-list-item';
            if (player.id === hostId) {
                li.classList.add('host');
            }

            li.innerHTML = `
        <span class="name">${this.escapeHtml(player.name)}</span>
        <span class="status">${player.isConnected ? '接続中' : '切断'}</span>
      `;

            list.appendChild(li);
        });

        this.lobbyElements.playerCount.textContent = `(${players.length}/8)`;
    }

    /**
     * ロビーメッセージを更新
     * @param {string} message 
     */
    setLobbyMessage(message) {
        this.lobbyElements.message.textContent = message;
    }

    /**
     * ゲーム開始ボタンの有効/無効
     * @param {boolean} enabled 
     */
    setStartGameEnabled(enabled) {
        this.lobbyElements.startGameBtn.disabled = !enabled;
    }

    // ===== ゲーム画面 =====

    /**
     * ラウンド番号を更新
     * @param {number} round 
     */
    setRoundNumber(round) {
        this.gameElements.roundNumber.textContent = round;

        // アニメーション
        if (window.gsap) {
            gsap.fromTo(this.gameElements.roundNumber,
                { scale: 1.5, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out' }
            );
        }
    }

    /**
     * 他プレイヤーの表示を更新
     * @param {Object[]} players - 自分以外のプレイヤー
     * @param {string} currentPlayerId - 現在のターンのプレイヤーID
     */
    updateOtherPlayers(players, currentPlayerId = null) {
        const container = this.gameElements.otherPlayers;
        container.innerHTML = '';

        players.forEach(player => {
            const card = document.createElement('div');
            card.className = 'player-card';
            card.dataset.id = player.id; // ★これが必要
            if (player.id === currentPlayerId) card.classList.add('active');
            if (player.isDealer) card.classList.add('dealer');

            // サイコロ表示
            const diceContainer = document.createElement('div');
            diceContainer.className = 'card-dice-container';
            if (player.currentDice && player.currentDice.length > 0) {
                player.currentDice.forEach(val => {
                    diceContainer.appendChild(DiceRenderer.createDiceElement(val));
                });
            } else {
                diceContainer.textContent = '- - -';
            }

            card.innerHTML = `
                <div class="card-name">${player.isDealer ? '👑 ' : ''}${this.escapeHtml(player.name)}</div>
                <div class="card-chips">💰 ${player.chips}</div>
            `;
            card.appendChild(diceContainer);

            container.appendChild(card);
        });
    }

    /**
     * 他プレイヤーのダイスを回転状態にする
     * @param {string} playerId - 対象プレイヤーのID
     */
    startOtherPlayerDiceRolling(playerId) {
        const card = this.gameElements.otherPlayers.querySelector(`.player-card[data-id="${playerId}"]`);
        if (!card) return;

        const diceContainer = card.querySelector('.card-dice-container');
        if (!diceContainer) return;

        // 既存のダイスを回転させる、または新規作成して回転
        const scenes = diceContainer.querySelectorAll('.dice-scene');
        if (scenes.length === 0) {
            // ダイスがない場合は作成して回転
            diceContainer.innerHTML = '';
            for (let i = 0; i < 3; i++) {
                const el = DiceRenderer.createDiceElement(null);
                diceContainer.appendChild(el);
                DiceRenderer.startRolling(el);
            }
        } else {
            // 既存のダイスを回転させる
            scenes.forEach(scene => DiceRenderer.startRolling(scene));
        }
    }

    /**
     * 親情報を更新
     * @param {string} name 
     * @param {number[]} dice 
     * @param {string} hand 
     */
    setDealerInfo(name, dice = null, hand = null) {
        this.gameElements.dealerName.textContent = name;
        this.showDice(this.gameElements.dealerDice, dice);
        this.gameElements.dealerHand.textContent = hand || '-';
    }

    /**
     * 現在プレイヤー情報を更新
     * @param {string} name 
     * @param {number[]} dice 
     * @param {string} hand 
     */
    setCurrentPlayerInfo(name, dice = null, hand = null) {
        this.gameElements.currentPlayerName.textContent = name || '-';
        this.showDice(this.gameElements.currentPlayerDice, dice);
        this.gameElements.currentPlayerHand.textContent = hand || '-';
    }

    /**
     * ダイス表示を更新（3D版）
     * @param {HTMLElement} container 
     * @param {number[]|null} dice 
     */
    showDice(container, dice) {
        container.innerHTML = ''; // 中身をクリア

        if (dice && dice.length > 0) {
            // 結果表示モード
            dice.forEach((val, i) => {
                const diceEl = DiceRenderer.createDiceElement(val);
                container.appendChild(diceEl);

                // 出現アニメーション（ズドン！）
                if (window.gsap) {
                    gsap.from(diceEl, {
                        y: -50,
                        opacity: 0,
                        duration: 0.5,
                        delay: i * 0.1,
                        ease: 'bounce.out'
                    });
                }
            });
        } else {
            // 待機モード（静止した3Dダイス）
            for (let i = 0; i < 3; i++) {
                // nullを渡すと「少し斜めの静止状態」で作られる
                const diceEl = DiceRenderer.createDiceElement(null);
                container.appendChild(diceEl);
            }
        }
    }

    /**
     * ダイスのローリングアニメーション開始
     * @param {HTMLElement} container 
     */
    startDiceRolling(container) {
        const scenes = container.querySelectorAll('.dice-scene');

        if (scenes.length === 0) {
            // もし要素がなければ作る
            container.innerHTML = '';
            for (let i = 0; i < 3; i++) {
                const el = DiceRenderer.createDiceElement(null);
                container.appendChild(el);
                DiceRenderer.startRolling(el);
            }
        } else {
            // 既存のダイスを回す
            scenes.forEach(scene => DiceRenderer.startRolling(scene));
        }
    }

    /**
     * 自分の情報を更新
     * @param {Object} player 
     */
    setMyInfo(player) {
        this.gameElements.myName.textContent = player.name;
        this.gameElements.myChips.textContent = player.chips;

        if (player.isDealer) {
            this.gameElements.myRoleBadge.textContent = '親';
            this.gameElements.myRoleBadge.style.display = 'inline';
        } else {
            this.gameElements.myRoleBadge.style.display = 'none';
        }
    }

    /**
     * スキル情報を更新
     * @param {Object} skill 
     */
    setMySkill(skill) {
        if (skill) {
            this.gameElements.mySkillName.textContent = skill.name;
            this.gameElements.mySkillDesc.textContent = skill.description || '';
            this.gameElements.useSkillBtn.disabled = !skill.canUse;
        } else {
            this.gameElements.mySkillName.textContent = 'スキル未配布';
            this.gameElements.mySkillDesc.textContent = '-';
            this.gameElements.useSkillBtn.disabled = true;
        }
    }

    // ===== コントロール表示 =====

    /**
     * ベットコントロールを表示/非表示
     * @param {boolean} show 
     */
    showBetControls(show) {
        this.gameElements.betControls.classList.toggle('hidden', !show);
        if (show) {
            this.currentBet = 0;
            this.gameElements.betAmount.textContent = '0';
        }
    }

    /**
     * ロールコントロールを表示/非表示
     * @param {boolean} show 
     */
    showRollControls(show) {
        if (show) {
            this.gameElements.rollControls.classList.remove('hidden');
            console.log('[UI] Roll controls shown, classes:', this.gameElements.rollControls.className);
        } else {
            this.gameElements.rollControls.classList.add('hidden');
        }
    }

    /**
     * ダウトコントロールを表示/非表示
     * @param {boolean} show 
     * @param {number} timeoutMs 
     */
    showDoubtControls(show, timeoutMs = 5000) {
        this.gameElements.doubtControls.classList.toggle('hidden', !show);

        if (show && window.gsap) {
            // タイマーバーアニメーション
            gsap.fromTo(this.gameElements.doubtTimerBar,
                { width: '100%' },
                { width: '0%', duration: timeoutMs / 1000, ease: 'linear' }
            );
        }
    }

    /**
     * ベットボタンのイベント設定（加算式）
     */
    setupBetButtons() {
        const betButtons = document.querySelectorAll('.bet-btn');
        betButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const amountStr = btn.dataset.amount;

                if (amountStr === 'reset') {
                    // リセット
                    this.currentBet = 0;
                } else if (amountStr === 'all') {
                    // ALL: 自分の所持チップ全額
                    const myChipsText = this.gameElements.myChips?.textContent || '0';
                    this.currentBet = parseInt(myChipsText.replace(/,/g, '')) || 0;
                } else {
                    // 数値: 加算
                    const amount = parseInt(amountStr);
                    this.currentBet += amount;

                    // 所持チップを超えないようにする
                    const myChipsText = this.gameElements.myChips?.textContent || '0';
                    const maxChips = parseInt(myChipsText.replace(/,/g, '')) || 0;

                    if (this.currentBet > maxChips) {
                        // 所持金不足でも1000ベット（最低額）なら許可
                        if (maxChips < 1000) {
                            this.currentBet = 1000;
                        } else {
                            this.currentBet = maxChips;
                        }
                    }
                }

                this.gameElements.betAmount.textContent = this.currentBet.toLocaleString();
            });
        });
    }

    /**
     * 現在のベット額を取得
     * @returns {number}
     */
    getBetAmount() {
        return this.currentBet;
    }

    // ===== モーダル =====

    /**
     * スキルアクションモーダルを表示（基本）
     * @param {Object} actionData 
     * @param {Function} onSelect 
     */
    showSkillActionModal(actionData, onSelect) {
        this.gameElements.skillActionTitle.textContent = actionData.skillName || 'スキル発動';
        this.gameElements.skillActionPrompt.textContent = actionData.prompt;

        const optionsContainer = this.gameElements.skillActionOptions;
        optionsContainer.innerHTML = '';

        // アクションタイプに応じたUIを生成
        switch (actionData.actionType) {
            case 'dice_select_multi':
                this.renderMultiDiceSelect(optionsContainer, actionData, onSelect);
                break;
            case 'swap_select':
                this.renderSwapSelect(optionsContainer, actionData, onSelect);
                break;
            case 'target_dice_select':
                this.renderTargetDiceSelect(optionsContainer, actionData, onSelect);
                break;
            default:
                this.renderDefaultOptions(optionsContainer, actionData, onSelect);
        }

        this.gameElements.skillActionModal.classList.remove('hidden');

        // GSAPアニメーション
        if (window.gsap) {
            gsap.fromTo(this.gameElements.skillActionModal.querySelector('.modal-content'),
                { scale: 0.8, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out' }
            );
        }
    }

    /**
     * デフォルトのオプションボタンをレンダリング
     */
    renderDefaultOptions(container, actionData, onSelect) {
        // ダイス表示（あれば）
        if (actionData.dice && actionData.dice.length > 0) {
            const diceDisplay = document.createElement('div');
            diceDisplay.className = 'modal-dice-display';
            diceDisplay.innerHTML = actionData.dice.map((d, i) =>
                `<div class="modal-dice" data-index="${i}">${d}</div>`
            ).join('');
            container.appendChild(diceDisplay);
        }

        actionData.options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'action-option';
            btn.innerHTML = `
                <strong>${option.label}</strong>
                <small>${option.description || ''}</small>
            `;
            btn.addEventListener('click', () => {
                this.hideSkillActionModal();
                onSelect(option.id);
            });
            container.appendChild(btn);
        });
    }

    /**
     * 複数ダイス選択UI（四次元の使い手用）
     */
    renderMultiDiceSelect(container, actionData, onSelect) {
        const { dice, selectCount } = actionData;
        const selected = new Set();

        // 説明
        const instruction = document.createElement('p');
        instruction.className = 'modal-instruction';
        instruction.textContent = `${dice.length}個のダイスから${selectCount}個を選んでください`;
        container.appendChild(instruction);

        // ダイス表示（クリックで選択）
        const diceDisplay = document.createElement('div');
        diceDisplay.className = 'modal-dice-display selectable';
        dice.forEach((d, i) => {
            const diceEl = document.createElement('div');
            diceEl.className = 'modal-dice';
            diceEl.dataset.index = i;
            diceEl.textContent = d;
            diceEl.addEventListener('click', () => {
                if (selected.has(i)) {
                    selected.delete(i);
                    diceEl.classList.remove('selected');
                } else if (selected.size < selectCount) {
                    selected.add(i);
                    diceEl.classList.add('selected');
                }
                confirmBtn.disabled = selected.size !== selectCount;
            });
            diceDisplay.appendChild(diceEl);
        });
        container.appendChild(diceDisplay);

        // 確定ボタン
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'gold-button primary';
        confirmBtn.textContent = `${selectCount}個選択して確定`;
        confirmBtn.disabled = true;
        confirmBtn.addEventListener('click', () => {
            this.hideSkillActionModal();
            onSelect(Array.from(selected));
        });
        container.appendChild(confirmBtn);
    }

    /**
     * 交換選択UI（すり替え用）
     */
    renderSwapSelect(container, actionData, onSelect) {
        const { myDice, opponentDice, opponentName } = actionData;
        let selectedMy = null;
        let selectedOpp = null;

        // 自分のダイス
        const mySection = document.createElement('div');
        mySection.className = 'swap-section';
        mySection.innerHTML = `<h4>自分のダイス</h4>`;
        const myDiceDisplay = document.createElement('div');
        myDiceDisplay.className = 'modal-dice-display selectable';
        myDice.forEach((d, i) => {
            const diceEl = document.createElement('div');
            diceEl.className = 'modal-dice';
            diceEl.dataset.index = i;
            diceEl.textContent = d;
            diceEl.addEventListener('click', () => {
                myDiceDisplay.querySelectorAll('.modal-dice').forEach(el => el.classList.remove('selected'));
                diceEl.classList.add('selected');
                selectedMy = i;
                confirmBtn.disabled = selectedMy === null || selectedOpp === null;
            });
            myDiceDisplay.appendChild(diceEl);
        });
        mySection.appendChild(myDiceDisplay);
        container.appendChild(mySection);

        // 交換マーク
        const swapMark = document.createElement('div');
        swapMark.className = 'swap-mark';
        swapMark.innerHTML = '⇅ 交換';
        container.appendChild(swapMark);

        // 相手のダイス
        const oppSection = document.createElement('div');
        oppSection.className = 'swap-section';
        oppSection.innerHTML = `<h4>${this.escapeHtml(opponentName)}のダイス</h4>`;
        const oppDiceDisplay = document.createElement('div');
        oppDiceDisplay.className = 'modal-dice-display selectable';
        opponentDice.forEach((d, i) => {
            const diceEl = document.createElement('div');
            diceEl.className = 'modal-dice';
            diceEl.dataset.index = i;
            diceEl.textContent = d;
            diceEl.addEventListener('click', () => {
                oppDiceDisplay.querySelectorAll('.modal-dice').forEach(el => el.classList.remove('selected'));
                diceEl.classList.add('selected');
                selectedOpp = i;
                confirmBtn.disabled = selectedMy === null || selectedOpp === null;
            });
            oppDiceDisplay.appendChild(diceEl);
        });
        oppSection.appendChild(oppDiceDisplay);
        container.appendChild(oppSection);

        // ボタン群
        const btnGroup = document.createElement('div');
        btnGroup.className = 'action-buttons';

        const skipBtn = document.createElement('button');
        skipBtn.className = 'gold-button secondary';
        skipBtn.textContent = 'スキップ';
        skipBtn.addEventListener('click', () => {
            this.hideSkillActionModal();
            onSelect('skip');
        });
        btnGroup.appendChild(skipBtn);

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'gold-button primary';
        confirmBtn.textContent = '交換実行';
        confirmBtn.disabled = true;
        confirmBtn.addEventListener('click', () => {
            this.hideSkillActionModal();
            onSelect({ myDiceIndex: selectedMy, opponentDiceIndex: selectedOpp });
        });
        btnGroup.appendChild(confirmBtn);

        container.appendChild(btnGroup);
    }

    /**
     * 相手のダイス選択UI（スナイパー用）
     */
    renderTargetDiceSelect(container, actionData, onSelect) {
        const { dice, targetPlayerName, options } = actionData;

        // 説明
        const instruction = document.createElement('p');
        instruction.className = 'modal-instruction';
        instruction.textContent = `${targetPlayerName}のダイスを選んで「1」に変えます`;
        container.appendChild(instruction);

        // ダイス表示
        const diceDisplay = document.createElement('div');
        diceDisplay.className = 'modal-dice-display target';
        dice.forEach((d, i) => {
            const diceEl = document.createElement('div');
            diceEl.className = 'modal-dice';
            diceEl.dataset.index = i;
            diceEl.innerHTML = `<span class="current">${d}</span><span class="arrow">→</span><span class="result">1</span>`;
            diceEl.addEventListener('click', () => {
                this.hideSkillActionModal();
                onSelect(i);
            });
            diceDisplay.appendChild(diceEl);
        });
        container.appendChild(diceDisplay);

        // スキップボタン
        if (options && options.find(o => o.id === 'skip')) {
            const skipBtn = document.createElement('button');
            skipBtn.className = 'gold-button secondary';
            skipBtn.textContent = 'スキップ';
            skipBtn.addEventListener('click', () => {
                this.hideSkillActionModal();
                onSelect('skip');
            });
            container.appendChild(skipBtn);
        }
    }

    /**
     * スキルアクションモーダルを非表示
     */
    hideSkillActionModal() {
        this.gameElements.skillActionModal.classList.add('hidden');
    }

    // ===== ビジュアルエフェクト =====

    /**
     * モザイク（ぼかし）エフェクトを適用
     * @param {number} duration - 持続時間（ミリ秒）
     */
    applyBlurEffect(duration = 15000) {
        document.body.classList.add('blur-effect');
        this.showToast('モザイク発動！画面がぼやける！', 'warning');

        setTimeout(() => {
            document.body.classList.remove('blur-effect');
        }, duration);
    }

    /**
     * スキル発動エフェクトを表示
     * @param {Object} effectData 
     */
    showSkillEffect(effectData) {
        if (!effectData) return;

        switch (effectData.type) {
            case 'GOD_EFFECT':
                this.freezeScreen(effectData.freezeDuration || 3000);
                this.showToast('GODハンド発動！！！', 'success');
                break;
            case 'REVOLUTION_EFFECT':
                this.showResultOverlay('革命！', effectData.message, 2000);
                break;
            case 'SNIPER_EFFECT':
            case 'FLIPPER_EFFECT':
            case 'SWITCH_EFFECT':
                this.showToast(effectData.message, 'success');
                break;
            case 'BOMBER_EFFECT':
                this.freezeScreen(1500);
                this.showResultOverlay('道連れ爆発！', effectData.message, 2500);
                break;
            case 'BANKER_WIN':
            case 'BANKER_LOSS':
                this.showToast(effectData.message, effectData.type === 'BANKER_WIN' ? 'success' : 'warning');
                break;
            case 'FOURTH_DIMENSION_EFFECT':
                this.showToast(effectData.message, 'info');
                break;
            case 'MOSAIC_EFFECT':
                // モザイクは別途applyBlurEffectで適用
                break;
            default:
                if (effectData.message) {
                    this.showToast(effectData.message, 'info');
                }
        }
    }

    // ===== オーバーレイ =====

    /**
     * 結果オーバーレイを表示
     * @param {string} title 
     * @param {string} details 
     * @param {number} duration 
     */
    showResultOverlay(title, details, duration = 3000) {
        this.gameElements.resultTitle.textContent = title;
        this.gameElements.resultDetails.innerHTML = details;
        this.gameElements.resultOverlay.classList.remove('hidden');

        if (window.gsap) {
            gsap.fromTo(this.gameElements.resultOverlay.querySelector('.result-content'),
                { scale: 0.5, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out' }
            );
        }

        if (duration > 0) {
            setTimeout(() => this.hideResultOverlay(), duration);
        }
    }

    /**
     * 結果オーバーレイを非表示
     */
    hideResultOverlay() {
        this.gameElements.resultOverlay.classList.add('hidden');
    }

    /**
     * フリーズ演出
     * @param {number} duration 
     */
    freezeScreen(duration = 3000) {
        const overlay = this.gameElements.freezeOverlay;
        overlay.classList.remove('hidden');

        if (window.gsap) {
            gsap.fromTo(overlay,
                { opacity: 0 },
                { opacity: 1, duration: 0.1 }
            );

            setTimeout(() => {
                gsap.to(overlay, {
                    opacity: 0,
                    duration: 0.5,
                    onComplete: () => overlay.classList.add('hidden')
                });
            }, duration);
        } else {
            setTimeout(() => overlay.classList.add('hidden'), duration);
        }
    }

    // ===== ログ =====

    /**
     * ログメッセージを追加
     * @param {string} message 
     * @param {string} type - 'normal' | 'important' | 'result' | 'warning'
     */
    logMessage(message, type = 'normal') {
        const log = this.gameElements.log;
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;

        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    /**
     * ログをクリア
     */
    clearLog() {
        this.gameElements.log.innerHTML = '';
    }

    // ===== トースト =====

    /**
     * トーストを表示
     * @param {string} message 
     * @param {string} type - 'info' | 'error' | 'success'
     * @param {number} duration 
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ===== ユーティリティ =====

    /**
     * HTMLエスケープ
     * @param {string} str 
     * @returns {string}
     */
    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ===== 役確定演出 =====

    /**
     * 役に応じた演出を再生
     * @param {Object} hand - 役情報
     * @param {number[]} dice - ダイスの値
     */
    playHandEffect(hand, dice) {
        if (!hand) return;

        switch (hand.type) {
            case 'pinzoro':
                this.playPinzoroEffect();
                break;
            case 'arashi':
                this.playArashiEffect(dice);
                break;
            case 'shigoro':
                this.playShigoroEffect();
                break;
            case 'hifumi':
                this.playHifumiEffect();
                break;
            default:
                // 通常の役は軽い演出
                if (hand.type === 'normal') {
                    this.announceHand(hand.displayName, 'normal');
                }
        }
    }

    /**
     * ピンゾロ演出 - GODフリーズ
     * 1. 暗転 2. 静寂（タメ） 3. 文字表示 4. 爆発解除
     */
    async playPinzoroEffect() {
        // ★ピンゾロ用サウンド再生
        try {
            const audio = new Audio('/assets/sounds/pinzoro.mp3');
            audio.volume = 0.8;
            audio.play().catch(e => console.warn('Audio play failed:', e));
        } catch (e) {
            console.warn('Audio creation failed:', e);
        }

        // 演出用オーバーレイを作成
        const overlay = document.createElement('div');
        overlay.className = 'god-freeze-overlay';
        overlay.innerHTML = '<div class="god-freeze-text" id="pinzoro-text"></div>';
        document.body.appendChild(overlay);

        // フェーズ1: 暗転
        if (window.gsap) {
            gsap.to(overlay, { opacity: 1, duration: 0.1 });
        }
        overlay.classList.add('active');

        // フェーズ2: 静寂（1.5秒のタメ）
        await this.sleep(1500);

        // フェーズ3: 文字を一文字ずつ表示
        const textContainer = document.getElementById('pinzoro-text');
        const chars = 'ＰＩＮＺＯＲＯ'.split('');

        for (let i = 0; i < chars.length; i++) {
            const span = document.createElement('span');
            span.textContent = chars[i];
            textContainer.appendChild(span);

            if (window.gsap) {
                gsap.fromTo(span,
                    { opacity: 0, y: 50, scale: 1.5 },
                    {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        duration: 0.3,
                        delay: i * 0.15,
                        ease: 'back.out(1.7)'
                    }
                );
            } else {
                span.style.opacity = 1;
            }
        }

        // 全文字表示後、少し待機
        await this.sleep(chars.length * 150 + 1000);

        // フェーズ4: 爆発エフェクトと共に解除
        const explosion = document.createElement('div');
        explosion.className = 'explosion-effect';
        document.body.appendChild(explosion);
        explosion.classList.add('active');

        if (window.gsap) {
            gsap.to(overlay, {
                opacity: 0,
                duration: 0.5,
                onComplete: () => {
                    overlay.remove();
                    explosion.remove();
                }
            });
        } else {
            setTimeout(() => {
                overlay.remove();
                explosion.remove();
            }, 500);
        }
    }

    /**
     * アラシ演出 - 雷撃
     * 1. フラッシュ 2. 振動 3. 金オーラ
     * @param {number[]} dice - ダイスの値
     */
    async playArashiEffect(dice) {
        // フェーズ1: 白フラッシュ
        const flash = document.createElement('div');
        flash.className = 'lightning-flash';
        document.body.appendChild(flash);
        flash.classList.add('active');

        // フェーズ2: 画面振動
        if (window.gsap) {
            gsap.to(document.body, {
                x: () => Math.random() * 16 - 8,
                y: () => Math.random() * 10 - 5,
                duration: 0.05,
                repeat: 10,
                yoyo: true,
                onComplete: () => {
                    gsap.set(document.body, { x: 0, y: 0 });
                }
            });
        } else {
            document.body.classList.add('screen-shake');
            setTimeout(() => document.body.classList.remove('screen-shake'), 500);
        }

        // フェーズ3: ダイスに金オーラ
        const diceElements = document.querySelectorAll('.dice, .dice-3d');
        diceElements.forEach(el => {
            el.classList.add('arashi-glow');
        });

        // 役名表示
        const value = dice ? dice[0] : '?';
        this.announceHand(`${value}のアラシ！`, 'arashi');

        // 演出終了
        await this.sleep(600);
        flash.remove();

        // 金オーラは3秒後に消す
        setTimeout(() => {
            diceElements.forEach(el => el.classList.remove('arashi-glow'));
        }, 3000);
    }

    /**
     * シゴロ演出
     */
    playShigoroEffect() {
        // 軽いフラッシュと振動
        if (window.gsap) {
            gsap.to(document.body, {
                x: 5,
                duration: 0.05,
                repeat: 6,
                yoyo: true,
                onComplete: () => gsap.set(document.body, { x: 0 })
            });
        }
        this.announceHand('シゴロ！', 'shigoro');
    }

    /**
     * ヒフミ演出
     */
    playHifumiEffect() {
        // 赤いフラッシュ
        const flash = document.createElement('div');
        flash.className = 'lightning-flash';
        flash.style.background = 'rgba(255, 0, 0, 0.6)';
        document.body.appendChild(flash);
        flash.classList.add('active');

        this.announceHand('ヒフミ...', 'hifumi');

        setTimeout(() => flash.remove(), 600);
    }

    /**
     * 役名を画面中央に表示
     * @param {string} text - 表示テキスト
     * @param {string} type - 役タイプ
     */
    announceHand(text, type = 'normal') {
        const announce = document.createElement('div');
        announce.className = `hand-announce ${type}`;
        announce.textContent = text;
        document.body.appendChild(announce);

        if (window.gsap) {
            gsap.fromTo(announce,
                { opacity: 0, scale: 0.5 },
                {
                    opacity: 1,
                    scale: 1,
                    duration: 0.3,
                    ease: 'back.out(1.7)',
                    onComplete: () => {
                        gsap.to(announce, {
                            opacity: 0,
                            scale: 1.2,
                            duration: 0.5,
                            delay: 1.5,
                            onComplete: () => announce.remove()
                        });
                    }
                }
            );
        } else {
            announce.style.opacity = 1;
            setTimeout(() => announce.remove(), 2000);
        }
    }

    /**
     * チップ移動アニメーション
     * @param {string} fromPlayerId - 支払う人のID
     * @param {string} toPlayerId - 受け取る人のID
     * @param {number} amount - 金額
     */
    animateChipTransfer(fromPlayerId, toPlayerId, amount) {
        if (!window.gsap || amount <= 0) return;

        // 始点と終点の要素を取得
        let startEl, endEl;

        // 自分かどうかで要素を探し分ける
        const myId = this.mySocketId || 'ME'; // main.jsからセットされる想定

        // from要素の特定
        if (fromPlayerId === myId) {
            startEl = this.gameElements.myChips;
        } else {
            startEl = this.gameElements.otherPlayers.querySelector(`.player-card[data-id="${fromPlayerId}"] .card-chips`);
        }

        // to要素の特定
        if (toPlayerId === myId) {
            endEl = this.gameElements.myChips;
        } else {
            endEl = this.gameElements.otherPlayers.querySelector(`.player-card[data-id="${toPlayerId}"] .card-chips`);
        }

        // 要素が見つからない場合のフォールバック（画面中央）
        const getRect = (el) => {
            if (el) return el.getBoundingClientRect();
            return { left: window.innerWidth / 2, top: window.innerHeight / 2 };
        };

        let startRect = getRect(startEl);
        let endRect = getRect(endEl);

        const count = Math.min(10, Math.ceil(amount / 100));

        for (let i = 0; i < count; i++) {
            const chip = document.createElement('div');
            chip.className = 'flying-chip';
            chip.textContent = '💰';
            document.body.appendChild(chip);

            // 始点（ランダムに散らす）
            const sx = startRect.left + (Math.random() * 50);
            const sy = startRect.top + (Math.random() * 50);

            // 終点
            const ex = endRect.left + (Math.random() * 20);
            const ey = endRect.top + (Math.random() * 20);

            gsap.fromTo(chip,
                { x: sx, y: sy, opacity: 1, scale: 1 },
                {
                    x: ex,
                    y: ey,
                    opacity: 0,
                    duration: 1 + Math.random() * 0.5,
                    ease: "power2.inOut",
                    delay: i * 0.05,
                    onComplete: () => chip.remove()
                }
            );
        }
    }



    /**
     * スリープ関数
     * @param {number} ms - ミリ秒
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default GameUI;

