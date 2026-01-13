/**
 * GameState - ゲーム状態の定義
 * 
 * ゲームフローの各フェーズを定義。
 * WAITING_FOR_ACTION は非同期スキルのユーザー入力待ち状態。
 */

export const GameState = {
    // ===== 待機系 =====
    WAITING: 'waiting',                       // プレイヤー参加待ち

    // ===== ゲーム開始 =====
    SKILL_DISTRIBUTION: 'skill_distribution', // スキル配布中

    // ===== ラウンド進行 =====
    BETTING: 'betting',                       // 子のベット決定
    DEALER_ROLL: 'dealer_roll',               // 親のダイスロール
    PLAYER_ROLL: 'player_roll',               // 子のダイスロール

    // ===== 割り込み・待機 =====
    INTERRUPT_WINDOW: 'interrupt_window',     // ダウト受付ウィンドウ
    WAITING_FOR_ACTION: 'waiting_for_action', // スキル選択待ち（非同期）

    // ===== 結果 =====
    RESULT: 'result',                         // 結果表示
    ROUND_END: 'round_end',                   // ラウンド終了
    GAME_END: 'game_end'                      // ゲーム終了
};

/**
 * ゲームフェーズの遷移ルール
 */
export const StateTransitions = {
    [GameState.WAITING]: [GameState.SKILL_DISTRIBUTION],
    [GameState.SKILL_DISTRIBUTION]: [GameState.BETTING],
    [GameState.BETTING]: [GameState.DEALER_ROLL],
    [GameState.DEALER_ROLL]: [GameState.INTERRUPT_WINDOW, GameState.WAITING_FOR_ACTION, GameState.DEALER_ROLL],
    [GameState.INTERRUPT_WINDOW]: [GameState.PLAYER_ROLL, GameState.RESULT, GameState.INTERRUPT_WINDOW],
    [GameState.WAITING_FOR_ACTION]: [GameState.INTERRUPT_WINDOW, GameState.DEALER_ROLL, GameState.PLAYER_ROLL, GameState.WAITING_FOR_ACTION],
    [GameState.PLAYER_ROLL]: [GameState.INTERRUPT_WINDOW, GameState.WAITING_FOR_ACTION, GameState.PLAYER_ROLL],
    [GameState.RESULT]: [GameState.ROUND_END],
    [GameState.ROUND_END]: [GameState.BETTING, GameState.GAME_END],
    [GameState.GAME_END]: [GameState.WAITING]
};

/**
 * 状態遷移が有効かチェック
 * @param {GameState} from 
 * @param {GameState} to 
 * @returns {boolean}
 */
export function isValidTransition(from, to) {
    const allowed = StateTransitions[from];
    return allowed ? allowed.includes(to) : false;
}

/**
 * ゲーム設定
 */
export const GameConfig = {
    MIN_PLAYERS: 2,  // テスト用に2人から開始可能
    MAX_PLAYERS: 8,
    INITIAL_CHIPS: 50000,
    MIN_BET: 1000,
    MAX_BET: Infinity,  // 上限なし（所持チップまでベット可能）
    MAX_REROLL_ATTEMPTS: 3,      // 目なし時の最大振り直し回数
    INTERRUPT_WINDOW_MS: 5000,   // ダウト受付時間（ミリ秒）
    ACTION_TIMEOUT_MS: 15000,    // スキル選択タイムアウト（ミリ秒）
    ROUNDS_PER_GAME: null,       // null = 無制限（チップが尽きるまで）
    SET_BONUS_CHIPS: 100000      // 1セット（親1巡）終了時に全員に加算
};


/**
 * イベントタイプ（Socket.io通信用）
 */
export const GameEvent = {
    // クライアント → サーバー
    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
    LEAVE_ROOM: 'leave_room',
    START_GAME: 'start_game',
    PLACE_BET: 'place_bet',
    ROLL_DICE: 'roll_dice',
    SKILL_ACTION: 'skill_action',
    DOUBT: 'doubt',

    // サーバー → クライアント
    ROOM_CREATED: 'room_created',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    GAME_STARTED: 'game_started',
    SKILL_ASSIGNED: 'skill_assigned',
    STATE_CHANGED: 'state_changed',
    DICE_ROLLED: 'dice_rolled',
    WAITING_FOR_ACTION: 'waiting_for_action',
    DOUBT_RESULT: 'doubt_result',
    ROUND_RESULT: 'round_result',
    GAME_ENDED: 'game_ended',
    ERROR: 'error'
};

export default { GameState, StateTransitions, isValidTransition, GameConfig, GameEvent };
