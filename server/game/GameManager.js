/**
 * GameManager - ゲームルーム管理
 * 
 * 複数のGameRoomインスタンスを管理し、
 * プレイヤーの接続・切断・再接続を処理する。
 */

import { GameRoom } from './GameRoom.js';
import { Player } from './Player.js';
import { GameConfig } from './GameState.js';

export class GameManager {
    /**
     * @param {Object} io - Socket.ioサーバーインスタンス
     */
    constructor(io) {
        /** @type {Object} Socket.ioインスタンス */
        this.io = io;

        /** @type {Map<string, GameRoom>} ルームID → GameRoom */
        this.rooms = new Map();

        /** @type {Map<string, string>} SocketID → RoomID */
        this.socketToRoom = new Map();

        /** @type {Map<string, string>} SocketID → PlayerID */
        this.socketToPlayer = new Map();
    }

    // ===== ルーム管理 =====

    /**
     * 新しいルームを作成
     * @param {string} hostSocketId - ホストのSocket ID
     * @param {string} hostName - ホストの表示名
     * @returns {Object} 結果
     */
    createRoom(hostSocketId, hostName) {
        // プレイヤーを作成
        const player = new Player(hostSocketId, hostName, hostSocketId);

        // ルームを作成
        const room = new GameRoom(hostSocketId, this.io);
        room.addPlayer(player);

        // 管理用マップに登録
        this.rooms.set(room.id, room);
        this.socketToRoom.set(hostSocketId, room.id);
        this.socketToPlayer.set(hostSocketId, player.id);

        // Socket.ioルームに参加
        const socket = this.io.sockets.sockets.get(hostSocketId);
        if (socket) {
            socket.join(room.id);
        }

        return {
            success: true,
            roomId: room.id,
            room: room.toJSON(),
            player: player.toPrivateJSON()
        };
    }

    /**
     * ルームに参加
     * @param {string} roomId - ルームID
     * @param {string} socketId - 参加者のSocket ID
     * @param {string} playerName - 参加者の表示名
     * @returns {Object} 結果
     */
    joinRoom(roomId, socketId, playerName) {
        const room = this.rooms.get(roomId.toUpperCase());

        if (!room) {
            return { success: false, error: 'ルームが見つかりません' };
        }

        if (room.players.size >= GameConfig.MAX_PLAYERS) {
            return { success: false, error: 'ルームが満員です' };
        }

        // プレイヤーを作成して追加
        const player = new Player(socketId, playerName, socketId);

        if (!room.addPlayer(player)) {
            return { success: false, error: 'ルームに参加できませんでした' };
        }

        // 管理用マップに登録
        this.socketToRoom.set(socketId, room.id);
        this.socketToPlayer.set(socketId, player.id);

        // Socket.ioルームに参加
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
            socket.join(room.id);
        }

        return {
            success: true,
            roomId: room.id,
            room: room.toJSON(),
            player: player.toPrivateJSON()
        };
    }

    /**
     * ルームから退出
     * @param {string} socketId 
     * @returns {Object} 結果
     */
    leaveRoom(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        const playerId = this.socketToPlayer.get(socketId);

        if (!roomId || !playerId) {
            return { success: false, error: '参加中のルームがありません' };
        }

        const room = this.rooms.get(roomId);
        if (room) {
            room.removePlayer(playerId);

            // ルームが空になったら削除
            if (room.players.size === 0) {
                this.rooms.delete(roomId);
            }
        }

        // 管理用マップから削除
        this.socketToRoom.delete(socketId);
        this.socketToPlayer.delete(socketId);

        // Socket.ioルームから退出
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
            socket.leave(roomId);
        }

        return { success: true };
    }

    /**
     * ルームを取得
     * @param {string} roomId 
     * @returns {GameRoom|undefined}
     */
    getRoom(roomId) {
        return this.rooms.get(roomId.toUpperCase());
    }

    /**
     * SocketIDからルームを取得
     * @param {string} socketId 
     * @returns {GameRoom|undefined}
     */
    getRoomBySocket(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        return roomId ? this.rooms.get(roomId) : undefined;
    }

    /**
     * SocketIDからプレイヤーIDを取得
     * @param {string} socketId 
     * @returns {string|undefined}
     */
    getPlayerIdBySocket(socketId) {
        return this.socketToPlayer.get(socketId);
    }

    // ===== 接続管理 =====

    /**
     * 切断時の処理
     * @param {string} socketId 
     */
    handleDisconnect(socketId) {
        const roomId = this.socketToRoom.get(socketId);
        const playerId = this.socketToPlayer.get(socketId);

        if (!roomId || !playerId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        const player = room.getPlayer(playerId);
        if (player) {
            player.disconnect();

            // ゲーム中なら切断を通知（削除はしない）
            if (room.state !== 'waiting') {
                room.broadcast('player_disconnected', {
                    playerId,
                    playerName: player.name
                });
            } else {
                // 待機中なら完全に削除
                this.leaveRoom(socketId);
            }
        }
    }

    /**
     * 再接続時の処理
     * @param {string} oldSocketId 
     * @param {string} newSocketId 
     * @param {string} playerId 
     * @returns {Object}
     */
    handleReconnect(oldSocketId, newSocketId, playerId) {
        // 古いマッピングを探す（playerId から逆引き）
        let targetRoomId = null;

        for (const [sockId, pId] of this.socketToPlayer.entries()) {
            if (pId === playerId) {
                targetRoomId = this.socketToRoom.get(sockId);
                // 古いマッピングを削除
                this.socketToRoom.delete(sockId);
                this.socketToPlayer.delete(sockId);
                break;
            }
        }

        if (!targetRoomId) {
            return { success: false, error: '再接続先が見つかりません' };
        }

        const room = this.rooms.get(targetRoomId);
        if (!room) {
            return { success: false, error: 'ルームが存在しません' };
        }

        const player = room.getPlayer(playerId);
        if (!player) {
            return { success: false, error: 'プレイヤーが見つかりません' };
        }

        // 再接続処理
        player.reconnect(newSocketId);
        this.socketToRoom.set(newSocketId, targetRoomId);
        this.socketToPlayer.set(newSocketId, playerId);

        // Socket.ioルームに再参加
        const socket = this.io.sockets.sockets.get(newSocketId);
        if (socket) {
            socket.join(targetRoomId);
        }

        room.broadcast('player_reconnected', {
            playerId,
            playerName: player.name
        });

        return {
            success: true,
            room: room.toJSON(),
            player: player.toPrivateJSON()
        };
    }

    // ===== ユーティリティ =====

    /**
     * 全ルームの情報を取得（デバッグ用）
     * @returns {Object[]}
     */
    getAllRooms() {
        return Array.from(this.rooms.values()).map(room => room.toJSON());
    }

    /**
     * 統計情報を取得
     * @returns {Object}
     */
    getStats() {
        let totalPlayers = 0;
        this.rooms.forEach(room => {
            totalPlayers += room.players.size;
        });

        return {
            roomCount: this.rooms.size,
            playerCount: totalPlayers,
            connectionCount: this.socketToRoom.size
        };
    }
}

export default GameManager;
