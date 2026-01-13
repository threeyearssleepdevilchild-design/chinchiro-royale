/**
 * 異能チンチロ・ロワイヤル - サーバーエントリーポイント
 * 
 * Express + Socket.io サーバー
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { GameManager } from './game/GameManager.js';
import { setupGameHandler } from './socket/gameHandler.js';

// ESM用の __dirname 取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== サーバー設定 =====
const PORT = process.env.PORT || 3000;
const app = express();
const httpServer = createServer(app);

// CORS設定（開発用に全許可）
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

// JSONパース
app.use(express.json());

// 静的ファイル配信（クライアント）
app.use(express.static(path.join(__dirname, '../client')));

// ===== Socket.io設定 =====
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    // 接続オプション
    pingTimeout: 60000,
    pingInterval: 25000
});

// ===== ゲームマネージャー初期化 =====
const gameManager = new GameManager(io);

// Socket.ioハンドラーを設定
setupGameHandler(io, gameManager);

// ===== REST API（おまけ） =====

// ヘルスチェック
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// サーバー統計
app.get('/api/stats', (req, res) => {
    res.json(gameManager.getStats());
});

// ルーム一覧（開発用）
app.get('/api/rooms', (req, res) => {
    res.json(gameManager.getAllRooms());
});

// ルーム情報取得
app.get('/api/rooms/:roomId', (req, res) => {
    const room = gameManager.getRoom(req.params.roomId);
    if (room) {
        res.json(room.toJSON());
    } else {
        res.status(404).json({ error: 'ルームが見つかりません' });
    }
});

// SPAフォールバック（全てのルートをindex.htmlに）
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ===== エラーハンドリング =====
app.use((err, req, res, next) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// ===== サーバー起動 =====
httpServer.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║    🎲 異能チンチロ・ロワイヤル サーバー 🎲               ║');
    console.log('║                                                           ║');
    console.log(`║    🌐 http://localhost:${PORT}                             ║`);
    console.log('║                                                           ║');
    console.log('║    Ready for connections...                               ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
});

// 未処理のPromise拒否をキャッチ
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection]', reason);
});

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
    console.error('[Uncaught Exception]', error);
    process.exit(1);
});

export { app, io, gameManager };
