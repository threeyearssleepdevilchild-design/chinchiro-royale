/**
 * gameHandler - Socket.ioイベントハンドラー
 * 
 * クライアントからのイベントを受け取り、GameRoomのメソッドを呼び出す。
 * エラーハンドリングを行い、無効な操作にはerrorイベントを返す。
 */

import { GameEvent } from '../game/GameState.js';

/**
 * Socket.ioハンドラーを設定
 * @param {Object} io - Socket.ioサーバーインスタンス
 * @param {GameManager} gameManager - ゲームマネージャー
 */
export function setupGameHandler(io, gameManager) {
    io.on('connection', (socket) => {
        console.log(`[接続] ${socket.id}`);

        // ===== ルーム操作 =====

        /**
         * ルーム作成
         * data: { playerName: string }
         */
        socket.on(GameEvent.CREATE_ROOM, (data, callback) => {
            try {
                const { playerName } = data;

                if (!playerName || playerName.trim().length === 0) {
                    return sendError(socket, callback, 'プレイヤー名を入力してください');
                }
                if (playerName.length > 20) {
                    return sendError(socket, callback, 'プレイヤー名は20文字以内にしてください');
                }

                const result = gameManager.createRoom(socket.id, playerName.trim());

                if (result.success) {
                    console.log(`[ルーム作成] ${result.roomId} by ${playerName}`);
                    socket.emit(GameEvent.ROOM_CREATED, result);
                    if (callback) callback(result);
                } else {
                    sendError(socket, callback, result.error);
                }
            } catch (error) {
                console.error('[CREATE_ROOM Error]', error);
                sendError(socket, callback, 'ルーム作成に失敗しました');
            }
        });

        /**
         * ルーム参加
         * data: { roomId: string, playerName: string }
         */
        socket.on(GameEvent.JOIN_ROOM, (data, callback) => {
            try {
                const { roomId, playerName } = data;

                if (!roomId || !playerName) {
                    return sendError(socket, callback, 'ルームIDとプレイヤー名を入力してください');
                }
                if (playerName.length > 20) {
                    return sendError(socket, callback, 'プレイヤー名は20文字以内にしてください');
                }

                const result = gameManager.joinRoom(roomId, socket.id, playerName.trim());

                if (result.success) {
                    console.log(`[ルーム参加] ${roomId} - ${playerName}`);
                    socket.emit('room_joined', result);
                    if (callback) callback(result);
                } else {
                    sendError(socket, callback, result.error);
                }
            } catch (error) {
                console.error('[JOIN_ROOM Error]', error);
                sendError(socket, callback, 'ルーム参加に失敗しました');
            }
        });

        /**
         * ルーム退出
         */
        socket.on(GameEvent.LEAVE_ROOM, (data, callback) => {
            try {
                const result = gameManager.leaveRoom(socket.id);
                if (callback) callback(result);
            } catch (error) {
                console.error('[LEAVE_ROOM Error]', error);
                sendError(socket, callback, 'ルーム退出に失敗しました');
            }
        });

        // ===== ゲーム操作 =====

        /**
         * ゲーム開始（ホストのみ）
         */
        socket.on(GameEvent.START_GAME, (data, callback) => {
            try {
                const room = gameManager.getRoomBySocket(socket.id);
                if (!room) {
                    return sendError(socket, callback, 'ルームに参加していません');
                }

                if (room.hostId !== socket.id) {
                    return sendError(socket, callback, 'ホストのみがゲームを開始できます');
                }

                const result = room.startGame();
                if (!result) {
                    return sendError(socket, callback, '最低2人必要です');
                }

                if (callback) callback({ success: true });
            } catch (error) {
                console.error('[START_GAME Error]', error.message);
                console.error('[START_GAME Stack]', error.stack);
                sendError(socket, callback, `ゲーム開始に失敗しました: ${error.message}`);
            }
        });

        /**
         * ベットを置く
         * data: { amount: number }
         */
        socket.on(GameEvent.PLACE_BET, (data, callback) => {
            try {
                const room = gameManager.getRoomBySocket(socket.id);
                const playerId = gameManager.getPlayerIdBySocket(socket.id);

                if (!room || !playerId) {
                    return sendError(socket, callback, 'ルームに参加していません');
                }

                const { amount } = data;
                if (typeof amount !== 'number' || amount <= 0) {
                    return sendError(socket, callback, '有効なベット額を入力してください');
                }

                const result = room.placeBet(playerId, amount);
                if (!result) {
                    return sendError(socket, callback, 'ベットに失敗しました');
                }

                if (callback) callback({ success: true });
            } catch (error) {
                console.error('[PLACE_BET Error]', error);
                sendError(socket, callback, 'ベットに失敗しました');
            }
        });

        /**
         * ダイスを振る
         */
        socket.on(GameEvent.ROLL_DICE, async (data, callback) => {
            try {
                const room = gameManager.getRoomBySocket(socket.id);
                const playerId = gameManager.getPlayerIdBySocket(socket.id);

                if (!room || !playerId) {
                    return sendError(socket, callback, 'ルームに参加していません');
                }

                // ★ダイスロール開始を全員に通知（アニメーション同期用）
                io.to(room.id).emit('rolling_started', { playerId });

                const result = await room.rollDice(playerId);

                if (!result.success) {
                    return sendError(socket, callback, result.error);
                }

                if (callback) callback(result);
            } catch (error) {
                console.error('[ROLL_DICE Error]', error);
                sendError(socket, callback, 'ダイスロールに失敗しました');
            }
        });


        /**
         * スキルアクション（非同期スキルへの応答）
         * data: { choice: 'keep' | 'reroll' | ... }
         */
        socket.on(GameEvent.SKILL_ACTION, async (data, callback) => {
            try {
                const room = gameManager.getRoomBySocket(socket.id);
                const playerId = gameManager.getPlayerIdBySocket(socket.id);

                if (!room || !playerId) {
                    return sendError(socket, callback, 'ルームに参加していません');
                }

                const result = await room.handleSkillAction(playerId, data);

                if (!result.success) {
                    return sendError(socket, callback, result.error);
                }

                if (callback) callback(result);
            } catch (error) {
                console.error('[SKILL_ACTION Error]', error);
                sendError(socket, callback, 'スキルアクションに失敗しました');
            }
        });

        /**
         * ダウト（イカサマ指摘）
         * data: { targetId: string }
         */
        socket.on(GameEvent.DOUBT, (data, callback) => {
            try {
                const room = gameManager.getRoomBySocket(socket.id);
                const playerId = gameManager.getPlayerIdBySocket(socket.id);

                if (!room || !playerId) {
                    return sendError(socket, callback, 'ルームに参加していません');
                }

                const { targetId } = data;
                if (!targetId) {
                    return sendError(socket, callback, 'ダウト対象を指定してください');
                }

                const result = room.handleDoubt(playerId, targetId);

                if (!result.success) {
                    return sendError(socket, callback, result.error);
                }

                if (callback) callback(result);
            } catch (error) {
                console.error('[DOUBT Error]', error);
                sendError(socket, callback, 'ダウトに失敗しました');
            }
        });

        // ===== 接続管理 =====

        /**
         * 切断時
         */
        socket.on('disconnect', (reason) => {
            console.log(`[切断] ${socket.id} - ${reason}`);
            gameManager.handleDisconnect(socket.id);
        });

        /**
         * 再接続試行
         * data: { playerId: string }
         */
        socket.on('reconnect_attempt', (data, callback) => {
            try {
                const { playerId } = data;
                if (!playerId) {
                    return sendError(socket, callback, 'プレイヤーIDが必要です');
                }

                const result = gameManager.handleReconnect(null, socket.id, playerId);

                if (result.success) {
                    console.log(`[再接続] ${playerId}`);
                }

                if (callback) callback(result);
            } catch (error) {
                console.error('[RECONNECT Error]', error);
                sendError(socket, callback, '再接続に失敗しました');
            }
        });

        // ===== デバッグ用 =====

        /**
         * サーバー統計取得
         */
        socket.on('get_stats', (data, callback) => {
            const stats = gameManager.getStats();
            if (callback) callback(stats);
        });

        /**
         * ルーム一覧取得（開発用）
         */
        /**
         * ルーム一覧取得（開発用）
         */
        socket.on('get_rooms', (data, callback) => {
            const rooms = gameManager.getAllRooms();
            if (callback) callback(rooms);
        });

        // ===== ゲーム終了後の操作 =====

        /**
         * 再戦リクエスト
         */
        socket.on('request_rematch', (data, callback) => {
            try {
                const room = gameManager.getPlayerRoom(socket.id);
                if (!room) {
                    return sendError(socket, callback, 'ルームが見つかりません');
                }

                // ゲームをリセットして新しいゲームを開始
                room.resetForRematch();

                if (callback) callback({ success: true });
            } catch (error) {
                console.error('[REMATCH Error]', error);
                sendError(socket, callback, '再戦の開始に失敗しました');
            }
        });

        /**
         * ロビーに戻る
         */
        socket.on('back_to_lobby', (data, callback) => {
            try {
                const room = gameManager.getPlayerRoom(socket.id);
                if (!room) {
                    return sendError(socket, callback, 'ルームが見つかりません');
                }

                // ゲーム状態をリセットしてロビー状態に戻す
                room.backToLobby();

                if (callback) callback({ success: true });
            } catch (error) {
                console.error('[BACK_TO_LOBBY Error]', error);
                sendError(socket, callback, 'ロビーへの移動に失敗しました');
            }
        });

        /**
         * ルーム退出
         */
        socket.on('leave_room', (data, callback) => {
            try {
                gameManager.removePlayer(socket.id);
                console.log(`[退出] ${socket.id}`);

                if (callback) callback({ success: true });
            } catch (error) {
                console.error('[LEAVE_ROOM Error]', error);
                sendError(socket, callback, '退出に失敗しました');
            }
        });

    });
}


/**
 * エラーを送信
 * @param {Object} socket 
 * @param {Function|null} callback 
 * @param {string} message 
 */
function sendError(socket, callback, message) {
    const errorData = { success: false, error: message };
    socket.emit(GameEvent.ERROR, errorData);
    if (callback) callback(errorData);
}

export default setupGameHandler;
