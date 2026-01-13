/**
 * 異能チンチロ・ロワイヤル - メインエントリーポイント
 * 
 * Socket.ioイベントとGameUIを連携させる。
 */

import { GameUI } from './ui/GameUI.js';

// ===== 初期化 =====
const ui = new GameUI();
const socket = io();

// 自分のプレイヤー情報
let myInfo = null;
let roomInfo = null;

socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    ui.showToast('サーバーとの接続が切れました。再接続を試みています...', 'error');

    // 再接続オーバーレイを表示
    showReconnectOverlay();
});

// 再接続成功時
socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    if (typeof ui !== 'undefined') {
        ui.setLobbyMessage('サーバーに接続しました。');
        ui.mySocketId = socket.id;
    }

    // 再接続オーバーレイを非表示
    hideReconnectOverlay();

    // ゲーム中だった場合、再接続を試みる
    if (myInfo && roomInfo) {
        console.log('[Socket] Attempting reconnect to game...');
        socket.emit('reconnect_attempt', { playerId: myInfo.id }, (response) => {
            if (response.success) {
                console.log('[Socket] Reconnected to game successfully');
                ui.showToast('ゲームに再接続しました', 'success');
                roomInfo = response.room;
                myInfo = response.player;
            } else {
                console.log('[Socket] Reconnect failed:', response.error);
                ui.showToast('再接続に失敗しました: ' + response.error, 'error');
            }
        });
    }
});

// 再接続オーバーレイ表示
function showReconnectOverlay() {
    let overlay = document.getElementById('reconnect-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'reconnect-overlay';
        overlay.className = 'reconnect-overlay';
        overlay.innerHTML = `
            <div class="reconnect-content">
                <div class="reconnect-spinner"></div>
                <h2>接続が切れました</h2>
                <p>再接続を試みています...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

function hideReconnectOverlay() {
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

socket.on('error', (data) => {
    console.error('[Socket] Error:', data);
    console.error('[Socket] Error details:', JSON.stringify(data, null, 2));
    ui.showToast(data.error || 'エラーが発生しました', 'error');
});

// ===== タイトル画面イベント =====

// ルーム作成
ui.titleElements.createRoomBtn.addEventListener('click', () => {
    const playerName = ui.titleElements.playerNameInput.value.trim();
    if (!playerName) {
        ui.showToast('プレイヤー名を入力してください', 'error');
        return;
    }

    socket.emit('create_room', { playerName }, (response) => {
        if (response.success) {
            handleRoomJoined(response);
        }
    });
});

// ルーム参加
ui.titleElements.joinRoomBtn.addEventListener('click', () => {
    const playerName = ui.titleElements.playerNameInput.value.trim();
    const roomId = ui.titleElements.roomIdInput.value.trim();

    if (!playerName) {
        ui.showToast('プレイヤー名を入力してください', 'error');
        return;
    }
    if (!roomId) {
        ui.showToast('ルームIDを入力してください', 'error');
        return;
    }

    socket.emit('join_room', { roomId, playerName }, (response) => {
        if (response.success) {
            handleRoomJoined(response);
        }
    });
});

/**
 * ルーム参加時の処理
 * @param {Object} response 
 */
function handleRoomJoined(response) {
    myInfo = response.player;
    roomInfo = response.room;

    ui.setRoomId(response.roomId);
    ui.updateLobbyPlayerList(response.room.players, response.room.hostId);
    ui.setStartGameEnabled(response.room.hostId === socket.id && response.room.players.length >= 2);
    ui.showScreen('lobby');

    ui.showToast(`ルーム ${response.roomId} に参加しました`, 'success');
}

// ===== ロビー画面イベント =====

// ルームIDコピー
ui.lobbyElements.copyRoomIdBtn.addEventListener('click', () => {
    const roomId = ui.lobbyElements.roomIdDisplay.textContent;
    navigator.clipboard.writeText(roomId).then(() => {
        ui.showToast('ルームIDをコピーしました', 'success');
    });
});

// ゲーム開始
ui.lobbyElements.startGameBtn.addEventListener('click', () => {
    socket.emit('start_game', {}, (response) => {
        if (!response.success) {
            ui.showToast(response.error || 'ゲーム開始に失敗しました', 'error');
        }
    });
});

// 退出
ui.lobbyElements.leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leave_room', {}, () => {
        myInfo = null;
        roomInfo = null;
        ui.showScreen('title');
    });
});

// プレイヤー参加
socket.on('player_joined', (data) => {
    if (roomInfo) {
        roomInfo.players = [...roomInfo.players.filter(p => p.id !== data.player.id), data.player];
        ui.updateLobbyPlayerList(roomInfo.players, roomInfo.hostId);
        ui.setStartGameEnabled(roomInfo.hostId === socket.id && roomInfo.players.length >= 2);
    }
    ui.showToast(`${data.player.name} が参加しました`, 'info');
});

// プレイヤー退出
socket.on('player_left', (data) => {
    if (roomInfo) {
        roomInfo.players = roomInfo.players.filter(p => p.id !== data.playerId);
        roomInfo.hostId = data.newHostId;
        ui.updateLobbyPlayerList(roomInfo.players, roomInfo.hostId);
        ui.setStartGameEnabled(roomInfo.hostId === socket.id && roomInfo.players.length >= 2);
    }
});

// ===== ゲーム開始イベント =====

socket.on('game_started', (data) => {
    console.log('[Game] Started:', data);
    roomInfo.players = data.players;

    ui.showScreen('game');
    ui.clearLog();
    ui.logMessage('ゲーム開始！', 'important');

    // 自分の情報を更新
    const me = data.players.find(p => p.id === socket.id);
    if (me) {
        ui.setMyInfo(me);
    }

    // 他プレイヤーを更新
    const others = data.players.filter(p => p.id !== socket.id);
    ui.updateOtherPlayers(others);

    // スキルなしモード: スキルコントロールを非表示
    ui.gameElements.skillControls.classList.add('hidden');
});

// スキル配布
socket.on('skill_assigned', (data) => {
    console.log('[Game] Skill assigned:', data);
    if (myInfo) {
        myInfo.skill = data.skill;
    }
    ui.setMySkill(data.skill);
    ui.logMessage(`スキル「${data.skill.name}」を獲得！`, 'important');
    ui.showToast(`スキル「${data.skill.name}」を獲得！`, 'success');
});

// ===== ラウンド進行イベント =====

socket.on('round_started', (data) => {
    console.log('[Game] Round started:', data);
    roomInfo.players = data.players;
    roomInfo.dealerId = data.dealerId; // 親IDを保存

    ui.setRoundNumber(data.roundNumber);
    ui.logMessage(`ラウンド ${data.roundNumber} 開始`, 'important');

    // 親情報を設定
    const dealer = data.players.find(p => p.id === data.dealerId);
    if (dealer) {
        ui.setDealerInfo(dealer.name);
        ui.logMessage(`親: ${dealer.name}`, 'normal');
    }

    // 自分の情報を更新
    const me = data.players.find(p => p.id === socket.id);
    if (me) {
        myInfo = { ...myInfo, ...me };
        ui.setMyInfo(me);
    }

    // 他プレイヤーを更新
    const others = data.players.filter(p => p.id !== socket.id);
    ui.updateOtherPlayers(others);

    // 現在プレイヤー表示をリセット
    ui.setCurrentPlayerInfo('-');

    // 通常のチンチロ: 子のみがベットする
    const isDealer = data.dealerId === socket.id;
    if (isDealer) {
        ui.showBetControls(false);
        ui.logMessage('あなたは親です。子プレイヤーのベットを待っています...', 'normal');
    } else {
        ui.showBetControls(true);
        ui.logMessage('ベット額を選択してください', 'normal');
    }
});

// 状態変更
socket.on('state_changed', (data) => {
    console.log('[Game] State changed:', data.currentState);

    // コントロール表示をリセット（ただし振り直しモード中はロールコントロールを保護）
    ui.showBetControls(false);
    // 振り直しモード中は showRollControls(false) をスキップ
    if (!window.isRerollMode) {
        ui.showRollControls(false);
    }
});


// ベッティングフェーズ
socket.on('state_changed', (data) => {
    if (data.currentState === 'betting') {
        // dealerIdを使って親かどうか判定（より確実）
        const isDealer = roomInfo?.dealerId === socket.id || myInfo?.isDealer;

        if (!isDealer) {
            // 子プレイヤー: ベットコントロールを表示
            ui.showBetControls(true);
            ui.logMessage('ベット額を選択してください', 'normal');
        } else {
            // 親: ベット不要、子のベット完了を待つ
            ui.showBetControls(false);
            ui.logMessage('親です。子プレイヤーのベットを待っています...', 'normal');
        }
    }
});

// ベット確定ボタン
ui.gameElements.confirmBetBtn.addEventListener('click', () => {
    const amount = ui.getBetAmount();
    if (amount <= 0) {
        ui.showToast('ベット額を選択してください', 'error');
        return;
    }

    socket.emit('place_bet', { amount }, (response) => {
        if (response.success) {
            ui.showBetControls(false);
            ui.logMessage(`${amount} チップをベット`, 'normal');
        }
    });
});

// ベット完了通知
socket.on('bet_placed', (data) => {
    if (data.playerId !== socket.id) {
        const player = roomInfo.players.find(p => p.id === data.playerId);
        if (player) {
            ui.logMessage(`${player.name} が ${data.amount} チップをベット`, 'normal');
        }
    }
});

// 親のターン
socket.on('dealer_turn', (data) => {
    console.log('[Game] Dealer turn:', data);

    if (data.dealerId === socket.id) {
        ui.showRollControls(true);
        ui.logMessage('あなたのターンです。ダイスを振ってください！', 'important');
    } else {
        ui.logMessage('親がダイスを振っています...', 'normal');
    }
});

// 子のターン
socket.on('player_turn', (data) => {
    console.log('[Game] Player turn:', data);

    const player = roomInfo.players.find(p => p.id === data.playerId);
    if (player) {
        ui.setCurrentPlayerInfo(player.name);
    }

    if (data.playerId === socket.id) {
        ui.showRollControls(true);
        ui.logMessage('あなたのターンです。ダイスを振ってください！', 'important');
    } else if (player) {
        ui.logMessage(`${player.name} のターン`, 'normal');
    }

    // 他プレイヤー表示を更新（アクティブ表示）
    const others = roomInfo.players.filter(p => p.id !== socket.id);
    ui.updateOtherPlayers(others, data.playerId);
});

// ダイスロールボタン
ui.gameElements.rollDiceBtn.addEventListener('click', () => {
    // 振り直しモードをOFF
    window.isRerollMode = false;

    // ローリングアニメーション開始
    const me = roomInfo.players.find(p => p.id === socket.id);
    if (me && me.isDealer) {
        ui.startDiceRolling(ui.gameElements.dealerDice);
    } else {
        ui.startDiceRolling(ui.gameElements.currentPlayerDice);
    }

    socket.emit('roll_dice', {}, (response) => {
        if (response.success) {
            // 振り直しが必要な場合はボタンを隠さない
            if (!response.needsReroll) {
                ui.showRollControls(false);
                // スキルコントロールを復帰
                ui.gameElements.skillControls.classList.remove('hidden');
            }
        } else {
            ui.showToast(response.error || 'ダイスロールに失敗しました', 'error');
        }
    });
});

// ★他プレイヤーがダイスをロールし始めたことを受信（アニメーション同期用）
socket.on('rolling_started', (data) => {
    console.log('[Game] Rolling started by:', data.playerId);

    const player = roomInfo.players.find(p => p.id === data.playerId);
    if (!player) return;

    // 自分がロールした場合は既にアニメーション開始済みなのでスキップ
    if (data.playerId === socket.id) return;

    // 該当プレイヤーが親か子かで表示先を決定
    if (player.isDealer) {
        ui.startDiceRolling(ui.gameElements.dealerDice);
    } else {
        // 他プレイヤーカード内のダイスを回転させる
        ui.startOtherPlayerDiceRolling(data.playerId);
    }
});


// ダイスロール結果
socket.on('dice_rolled', (data) => {
    console.log('[Game] Dice rolled:', data);

    // ★演出のために1.2秒待機してから結果を表示する（グリグリ回転を見せる）
    setTimeout(() => {
        const player = roomInfo.players.find(p => p.id === data.playerId);

        // 表示を更新（ここで3Dダイスが結果の目で再描画され、停止状態になる）
        if (player && player.isDealer) {
            ui.setDealerInfo(player.name, data.dice, data.hand.displayName);
        } else if (player) {
            ui.setCurrentPlayerInfo(player.name, data.dice, data.hand.displayName);
        }

        // ログ表示
        if (player) {
            ui.logMessage(`${player.name}: ${data.dice.join('-')} → ${data.hand.displayName}`, 'result');
        }

        // 役に応じた演出（ピンゾロやアラシなど）
        if (data.hand && !data.canReroll) {
            ui.playHandEffect(data.hand, data.dice);
        }

        // スキル演出効果（GODハンドなど）
        if (data.effectData) {
            if (data.effectData.type === 'GOD_EFFECT') {
                // GODハンドの場合は少し長めに演出
                setTimeout(() => {
                    ui.freezeScreen(data.effectData.freezeDuration || 3000);
                    ui.showToast('GODハンド発動！！！', 'success');
                }, 500);
            } else {
                ui.showSkillEffect(data.effectData);
            }
        }

        // 振り直し可能な場合（目なし）
        console.log('[Debug] canReroll check:', data.canReroll, 'playerId:', data.playerId, 'socket.id:', socket.id, 'myInfo.id:', myInfo?.id);
        if (data.canReroll && (data.playerId === socket.id || data.playerId === myInfo?.id)) {
            // 振り直しモードをON
            window.isRerollMode = true;

            // 振り直しのために全てのコントロールを非表示にし、ロールコントロールのみ表示
            ui.showBetControls(false);
            ui.gameElements.skillControls.classList.add('hidden');
            ui.showRollControls(true);
            ui.logMessage(`目なし！振り直し可能 (${data.rerollCount}/3)`, 'warning');
            console.log('[Debug] Roll controls shown for reroll, isRerollMode = true');
        } else {
            // 振り直しモードをOFF
            window.isRerollMode = false;
        }

    }, 1200); // 1200ミリ秒 = 1.2秒間グリグリ回るのを見せる
});

// ===== 非同期スキルアクション =====


socket.on('waiting_for_action', (data) => {
    console.log('[Game] Waiting for action:', data);

    ui.showSkillActionModal(data.actionData, (choice) => {
        socket.emit('skill_action', { choice }, (response) => {
            if (!response.success) {
                ui.showToast(response.error || 'アクションに失敗しました', 'error');
            }
        });
    });
});

socket.on('player_deciding', (data) => {
    const player = roomInfo.players.find(p => p.id === data.playerId);
    if (player) {
        ui.logMessage(`${player.name} が「${data.skillName}」を発動中...`, 'important');
    }
});

// ===== ビジュアルエフェクト・ダイス更新 =====

// 自分へのビジュアルエフェクト（モザイク等）
socket.on('visual_effect', (data) => {
    console.log('[Game] Visual effect:', data);

    if (data.type === 'MOSAIC' && data.cssClass) {
        ui.applyBlurEffect(data.duration || 15000);
    } else {
        // 汎用エフェクト表示
        ui.showSkillEffect(data);
    }
});

// スキルによるビジュアルエフェクト発動通知
socket.on('skill_visual_effect', (data) => {
    console.log('[Game] Skill visual effect:', data);

    // 自分が対象でなければログに表示
    if (!data.targetPlayerIds.includes(socket.id)) {
        ui.logMessage(`${data.type}スキルが発動！`, 'important');
    }
});

// 相手のダイスが更新された（Sniper、Switch等）
socket.on('dice_updated', (data) => {
    console.log('[Game] Dice updated:', data);

    const player = roomInfo.players.find(p => p.id === data.playerId);
    if (!player) return;

    // プレイヤーのダイス情報を更新
    player.currentDice = data.newDice;
    player.currentHand = data.newHand;

    // 表示を更新
    if (player.isDealer) {
        ui.setDealerInfo(player.name, data.newDice, data.newHand.displayName);
    } else {
        ui.setCurrentPlayerInfo(player.name, data.newDice, data.newHand.displayName);
    }

    // 他プレイヤー表示を更新
    const others = roomInfo.players.filter(p => p.id !== socket.id);
    ui.updateOtherPlayers(others);

    // エフェクト表示
    if (data.effectData) {
        ui.showSkillEffect(data.effectData);
        ui.logMessage(data.effectData.message || 'ダイスが変更された！', 'warning');
    }
});

// スキル効果通知
socket.on('skill_effect', (data) => {
    console.log('[Game] Skill effect:', data);
    if (data.message) {
        ui.logMessage(data.message, 'important');
    }
});

// ===== ラウンド結果 =====

socket.on('round_result', (data) => {
    console.log('[Game] Round result:', data);

    // チップ移動アニメーション
    data.results.forEach(result => {
        if (result.chipTransfer > 0) {
            if (result.winner === 'dealer') {
                ui.animateChipTransfer(result.playerId, result.dealerId, result.chipTransfer);
            } else if (result.winner === 'player') {
                ui.animateChipTransfer(result.dealerId, result.playerId, result.chipTransfer);
            }
        }
    });

    // アニメーション完了を待ってから数値更新（1.5秒後）
    setTimeout(() => {
        roomInfo.players = data.players;

        // 自分の更新
        const me = roomInfo.players.find(p => p.id === socket.id);
        if (me) {
            myInfo = { ...myInfo, ...me };
            // ui.setMyInfo(me) だとアニメーションする前のsetChipsとかが走るかもしれないので、
            // シンプルにチップとロールバッジだけ更新するか、setMyInfoに任せるか。
            // ここではsetMyInfoを使うのが行儀が良い。
            ui.setMyInfo(me);
        }

        // 他プレイヤー表示を更新
        const others = roomInfo.players.filter(p => p.id !== socket.id);
        ui.updateOtherPlayers(others);
    }, 1500);

    // 結果をログに表示
    data.results.forEach(result => {
        const player = (roomInfo.players || []).find(p => p.id === result.playerId) ||
            (data.players || []).find(p => p.id === result.playerId);

        if (player) {
            const sign = result.winner === 'player' ? '+' : '-';
            ui.logMessage(
                `${player.name}: ${result.playerHand.displayName} vs 親 → ${result.winner === 'player' ? '勝ち' : '負け'} (${sign}${result.chipTransfer})`,
                result.winner === 'player' ? 'result' : 'normal'
            );
        }
    });



});

// ===== ゲーム終了 =====

socket.on('game_ended', (data) => {
    console.log('[Game] Game ended:', data);

    let rankingHtml = '<ol>';
    data.ranking.forEach((r, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        rankingHtml += `<li>${medal} ${r.name}: ${r.chips} チップ</li>`;
    });
    rankingHtml += '</ol>';

    ui.showResultOverlay('ゲーム終了！', rankingHtml, 0);
    ui.logMessage('ゲーム終了！', 'important');

    // アクションボタンを表示
    const resultActions = document.getElementById('result-actions');
    if (resultActions) {
        resultActions.classList.remove('hidden');
    }
});

// ★セット完了（親1巡終了）→全員に10万点ボーナス
socket.on('set_completed', (data) => {
    console.log('[Game] Set completed:', data);

    ui.showToast(`セット${data.setNumber}終了！全員に ${data.bonusAmount.toLocaleString()} 点ボーナス！`, 'success');
    ui.logMessage(`セット${data.setNumber}終了！全員に ${data.bonusAmount.toLocaleString()} 点加算`, 'important');

    // 自分のチップを更新
    const me = data.players.find(p => p.id === socket.id);
    if (me) {
        ui.setMyInfo(me);
    }

    // 他プレイヤーを更新
    const others = data.players.filter(p => p.id !== socket.id);
    ui.updateOtherPlayers(others);
});

// ゲームリセット（再戦）
socket.on('game_reset', (data) => {
    console.log('[Game] Game reset:', data);
    ui.logMessage('--- 新しいゲームが始まります ---', 'result');
    ui.showToast('新しいゲームが始まります', 'info');

    // オーバーレイを確実に消す
    ui.hideResultOverlay();
    document.getElementById('result-actions')?.classList.add('hidden');

    // ゲーム画面の状態をリセット（必要ならDiceの消去など）
    const diceContainers = document.querySelectorAll('.dice-container');
    diceContainers.forEach(container => container.innerHTML = '');
});

// ロビーへ戻る
socket.on('returned_to_lobby', (data) => {
    console.log('[Game] Returned to lobby:', data);
    ui.showScreen('lobby');
    ui.hideResultOverlay();
    document.getElementById('result-actions')?.classList.add('hidden');

    if (roomInfo) {
        roomInfo.players = data.players; // プレイヤー情報を更新
        ui.updateLobbyPlayerList(roomInfo.players, roomInfo.hostId);

        // ホストならゲーム開始ボタンの状態を更新
        if (roomInfo.hostId === socket.id) {
            ui.setStartGameEnabled(roomInfo.players.length >= 2);
        }
    }
});


// 再戦ボタン
document.getElementById('btn-rematch')?.addEventListener('click', () => {
    socket.emit('request_rematch', {}, (response) => {
        if (response.success) {
            // 結果オーバーレイを非表示
            ui.hideResultOverlay();
            document.getElementById('result-actions')?.classList.add('hidden');
            ui.showToast('ゲームを再開します！', 'success');
        } else {
            ui.showToast(response.error || '再戦リクエストに失敗しました', 'error');
        }
    });
});

// ロビーに戻るボタン
document.getElementById('btn-back-to-lobby')?.addEventListener('click', () => {
    socket.emit('back_to_lobby', {}, (response) => {
        if (response.success) {
            // 結果オーバーレイを非表示
            ui.hideResultOverlay();
            document.getElementById('result-actions')?.classList.add('hidden');
            // ロビー画面に遷移
            ui.showScreen('lobby');
            ui.showToast('ロビーに戻りました', 'info');
        } else {
            ui.showToast(response.error || 'ロビーへの移動に失敗しました', 'error');
        }
    });
});


// ===== 切断/再接続 =====

socket.on('player_disconnected', (data) => {
    ui.logMessage(`${data.playerName} が切断しました`, 'warning');
    ui.showToast(`${data.playerName} が切断しました`, 'error');
});

socket.on('player_reconnected', (data) => {
    ui.logMessage(`${data.playerName} が再接続しました`, 'result');
    ui.showToast(`${data.playerName} が再接続しました`, 'success');
});

// ===== 初期画面表示 =====
ui.showScreen('title');
console.log('[App] 異能チンチロ・ロワイヤル 初期化完了');
