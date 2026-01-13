
export class DiceRenderer {
    /**
     * 3DサイコロのHTML要素を生成する
     * @param {number|null} value - 出目 (1-6, nullなら?)
     * @returns {HTMLElement}
     */
    createDiceElement(value) {
        const scene = document.createElement('div');
        scene.className = 'dice-scene';

        const cube = document.createElement('div');
        cube.className = 'dice-cube';

        // 6つの面を生成
        const faces = [
            { class: 'front', value: 1 },
            { class: 'right', value: 2 },
            { class: 'back', value: 3 },
            { class: 'left', value: 4 },
            { class: 'top', value: 5 },
            { class: 'bottom', value: 6 }
        ];

        faces.forEach(face => {
            const faceEl = document.createElement('div');
            faceEl.className = `dice-face face-${face.class}`;
            faceEl.innerHTML = this.getPipsHtml(face.value);
            cube.appendChild(faceEl);
        });

        scene.appendChild(cube);

        // 初期状態の設定
        if (value) {
            this.setResult(scene, value);
        } else {
            // 待機状態：少し斜めにして3D感を見せつける
            cube.style.transform = 'rotateX(-20deg) rotateY(20deg)';
        }

        return scene;
    }

    /**
     * 回転アニメーション開始
     * @param {HTMLElement} diceScene - createDiceElementで返された要素
     */
    startRolling(diceScene) {
        const cube = diceScene.querySelector('.dice-cube');
        if (cube) {
            cube.classList.add('rolling');
            // 回転中はtransformを解除してCSSアニメーションに任せる
            cube.style.transform = '';
        }
    }

    /**
     * 回転を止めて結果を表示
     * @param {HTMLElement} diceScene 
     * @param {number} value 
     */
    setResult(diceScene, value) {
        const cube = diceScene.querySelector('.dice-cube');
        if (!cube) return;

        cube.classList.remove('rolling');

        // 各目に対応する回転角度 [x, y]
        const rotations = {
            1: [0, 0],      // 正面
            2: [0, -90],    // 右
            3: [0, -180],   // 裏
            4: [0, 90],     // 左
            5: [-90, 0],    // 上
            6: [90, 0]      // 下
        };

        const [x, y] = rotations[value] || [0, 0];

        // 少しランダムな傾きを加えて「投げた後の止まり方」っぽくする
        const randomX = (Math.random() - 0.5) * 10;
        const randomY = (Math.random() - 0.5) * 10;

        cube.style.transform = `rotateX(${x + randomX}deg) rotateY(${y + randomY}deg)`;
    }

    getPipsHtml(value) {
        // ドット生成ロジック（変更なし）
        const positions = {
            1: ['e'],
            2: ['a', 'i'],
            3: ['a', 'e', 'i'],
            4: ['a', 'c', 'g', 'i'],
            5: ['a', 'c', 'e', 'g', 'i'],
            6: ['a', 'c', 'd', 'f', 'g', 'i']
        }[value] || [];

        let pips = '';
        const isOne = value === 1;
        const pipClass = isOne ? 'pip red big' : 'pip';

        for (let i = 0; i < value; i++) {
            const style = positions[i] ? `grid-area: ${positions[i]};` : '';
            pips += `<span class="${pipClass}" style="${style}"></span>`;
        }
        return `<div class="dice-face-inner">${pips}</div>`;
    }
}

export default new DiceRenderer();
