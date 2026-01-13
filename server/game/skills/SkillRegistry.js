/**
 * SkillRegistry - スキル登録・管理
 * 
 * 全スキルを登録し、ゲーム開始時にランダムにスキルを配布する。
 */

import { GodHand } from './GodHand.js';
import { GravityMaster } from './GravityMaster.js';
import { Revolutionary } from './Revolutionary.js';
import { Banker } from './Banker.js';
import { Bomber } from './Bomber.js';
import { Mosaic } from './Mosaic.js';
import { Sniper } from './Sniper.js';
import { Flipper } from './Flipper.js';
import { Switch } from './Switch.js';
import { FourthDimension } from './FourthDimension.js';

export class SkillRegistry {
    constructor() {
        /** @type {Map<string, typeof BaseSkill>} */
        this.skills = new Map();

        // デフォルトスキルを登録
        this.registerDefaults();
    }

    /**
     * デフォルトのスキルを登録
     */
    registerDefaults() {
        // イカサマ系
        this.register('god_hand', GodHand);
        this.register('switch', Switch);

        // インタラクティブ系
        this.register('gravity_master', GravityMaster);
        this.register('sniper', Sniper);
        this.register('flipper', Flipper);
        this.register('fourth_dimension', FourthDimension);

        // パッシブ系
        this.register('revolutionary', Revolutionary);
        this.register('banker', Banker);
        this.register('bomber', Bomber);

        // ビジュアル妨害系
        this.register('mosaic', Mosaic);
    }

    /**
     * スキルを登録
     * @param {string} skillId - スキルID
     * @param {typeof BaseSkill} SkillClass - スキルクラス
     */
    register(skillId, SkillClass) {
        this.skills.set(skillId, SkillClass);
    }

    /**
     * スキルIDからインスタンスを生成
     * @param {string} skillId - スキルID
     * @returns {BaseSkill|null}
     */
    create(skillId) {
        const SkillClass = this.skills.get(skillId);
        if (!SkillClass) {
            console.warn(`スキルが見つかりません: ${skillId}`);
            return null;
        }
        return new SkillClass();
    }

    /**
     * 登録されているスキルIDの一覧を取得
     * @returns {string[]}
     */
    getSkillIds() {
        return Array.from(this.skills.keys());
    }

    /**
     * ランダムにスキルを選択して配布
     * @param {number} count - 配布するスキル数
     * @param {Object} options - オプション
     * @param {boolean} [options.allowDuplicates=false] - 重複を許可するか
     * @param {string[]} [options.excludeIds=[]] - 除外するスキルID
     * @returns {BaseSkill[]}
     */
    getRandomSkills(count, options = {}) {
        const { allowDuplicates = false, excludeIds = [] } = options;

        const availableIds = this.getSkillIds().filter(id => !excludeIds.includes(id));

        if (!allowDuplicates && count > availableIds.length) {
            console.warn(`要求スキル数(${count})が利用可能スキル数(${availableIds.length})を超えています`);
            count = availableIds.length;
        }

        const selectedSkills = [];
        const usedIds = new Set();

        for (let i = 0; i < count; i++) {
            let candidateIds = allowDuplicates
                ? availableIds
                : availableIds.filter(id => !usedIds.has(id));

            if (candidateIds.length === 0) break;

            const randomIndex = Math.floor(Math.random() * candidateIds.length);
            const selectedId = candidateIds[randomIndex];

            usedIds.add(selectedId);
            selectedSkills.push(this.create(selectedId));
        }

        return selectedSkills;
    }

    /**
     * 全スキルの情報を取得（ゲームロビー等での表示用）
     * @returns {Object[]}
     */
    getAllSkillInfo() {
        return this.getSkillIds().map(id => {
            const skill = this.create(id);
            return skill.toJSON();
        });
    }
}

export default SkillRegistry;
