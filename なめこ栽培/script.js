document.addEventListener('DOMContentLoaded', function() {
    const gameArea = document.getElementById('game-area');
    const scoreDisplay = document.getElementById('score');
    const logLevelDisplay = document.getElementById('log-level');
    const expToNextLevelDisplay = document.getElementById('exp-to-next-level');
    const resetDataButton = document.getElementById('reset-data-button');

    const zukanList = document.getElementById('zukan-list');
    const zukanCollectedCountDisplay = document.getElementById('zukan-collected-count');
    const zukanTotalCountDisplay = document.getElementById('zukan-total-count');

    // Sound elements
    const harvestSound = document.getElementById('harvest-sound');
    const rareHarvestSound = document.getElementById('rare-harvest-sound');
    const growSound = document.getElementById('grow-sound');
    const bgm = document.getElementById('bgm');
    const bgmVolumeControl = document.getElementById('bgm-volume');
    const sfxVolumeControl = document.getElementById('sfx-volume');

    // --- なめこの種類定義 ---
    const NAMEKO_TYPES = {
        normal: {
            id: 'normal',
            name: 'ふつうなめこ',
            cssClass: 'type-normal',
            score: 10,
            growthTime: [2000, 3000, 4000], // 小→中→大 の時間(ms)
            rarity: 0.7, // 出現確率 (0.0 ~ 1.0)
            sound: harvestSound
        },
        white: {
            id: 'white',
            name: 'しろなめこ',
            cssClass: 'type-white',
            score: 30,
            growthTime: [2500, 3500, 4500],
            rarity: 0.25,
            sound: harvestSound
        },
        rare: {
            id: 'rare',
            name: 'レアなめこ',
            cssClass: 'type-rare',
            score: 100,
            growthTime: [4000, 5000, 7000],
            rarity: 0.05,
            sound: rareHarvestSound
        }
        // 他にも種類を追加可能
    };
    zukanTotalCountDisplay.textContent = Object.keys(NAMEKO_TYPES).length;

    let gameState = {
        score: 0,
        logLevel: 1,
        currentExp: 0,
        expForNextLevel: [0, 100, 250, 500, 1000], // レベルアップに必要な経験値
        zukan: {}, // { normal: true, white: false, ... }
        bgmVolume: 0.5,
        sfxVolume: 0.5
    };

    const MAX_NAMEKO_ON_LOG = 8; // 原木に同時に生える最大数
    let namekoElements = {}; // 画面上のなめこ要素を管理 {id: element}
    let namekoData = {}; // なめこの詳細データ {id: {type, stage, timerId}}
    let namekoIdCounter = 0;

    // --- 初期化処理 ---
    function initGame() {
        loadGameState();
        updateScoreDisplay();
        updateLogLevelDisplay();
        updateZukanDisplay();
        applyVolumeSettings();
        startBGM();

        // 定期的ななめこ発生タイマー
        setInterval(trySpawnNameko, 3000); // 3秒ごとに発生試行
        // 既存のなめこをロード（発展：ページリロードしても消えないようにする場合）
        // 今回はリセット前提なので、ロード処理は簡易
        Object.values(namekoElements).forEach(el => el.remove());
        namekoElements = {};
        namekoData = {};
    }

    // --- 音声制御 ---
    function playSound(soundElement) {
        if (soundElement && gameState.sfxVolume > 0) {
            soundElement.currentTime = 0;
            soundElement.volume = gameState.sfxVolume;
            soundElement.play().catch(e => console.warn("Audio play failed:", e));
        }
    }

    function startBGM() {
        if (bgm && gameState.bgmVolume > 0) {
            bgm.volume = gameState.bgmVolume;
            bgm.play().catch(e => console.warn("BGM play failed:", e));
        }
    }
    function stopBGM() {
        if (bgm) bgm.pause();
    }

    bgmVolumeControl.addEventListener('input', (e) => {
        gameState.bgmVolume = parseFloat(e.target.value);
        bgm.volume = gameState.bgmVolume;
        if (gameState.bgmVolume > 0 && bgm.paused) {
            startBGM();
        } else if (gameState.bgmVolume === 0) {
            stopBGM();
        }
        saveGameState();
    });

    sfxVolumeControl.addEventListener('input', (e) => {
        gameState.sfxVolume = parseFloat(e.target.value);
        saveGameState();
    });
    
    function applyVolumeSettings() {
        bgmVolumeControl.value = gameState.bgmVolume;
        sfxVolumeControl.value = gameState.sfxVolume;
        bgm.volume = gameState.bgmVolume;
        // 効果音は再生時に都度設定
    }

    // --- なめこロジック ---
    function trySpawnNameko() {
        if (Object.keys(namekoElements).length >= MAX_NAMEKO_ON_LOG * gameState.logLevel) return; // 原木レベルに応じて上限変化

        // レアリティに基づいてなめこの種類を決定
        let random = Math.random();
        let cumulativeRarity = 0;
        let selectedTypeKey = 'normal'; // デフォルト

        for (const typeKey in NAMEKO_TYPES) {
            cumulativeRarity += NAMEKO_TYPES[typeKey].rarity;
            if (random < cumulativeRarity) {
                selectedTypeKey = typeKey;
                break;
            }
        }
        spawnNameko(selectedTypeKey);
    }

    function spawnNameko(typeKey) {
        const type = NAMEKO_TYPES[typeKey];
        if (!type) return;

        const id = 'nameko-' + namekoIdCounter++;
        const namekoEl = document.createElement('div');
        namekoEl.id = id;
        namekoEl.classList.add('nameko', type.cssClass, 'stage-small');

        // なめこの構造 (傘と軸、目)
        const kasa = document.createElement('div');
        kasa.classList.add('nameko-kasa');
        const jiku = document.createElement('div');
        jiku.classList.add('nameko-jiku');
        const eyeL = document.createElement('div');
        eyeL.classList.add('nameko-eye', 'left');
        const eyeR = document.createElement('div');
        eyeR.classList.add('nameko-eye', 'right');
        
        kasa.appendChild(eyeL);
        kasa.appendChild(eyeR);
        namekoEl.appendChild(kasa);
        namekoEl.appendChild(jiku);

        // 位置決め
        const gameAreaRect = gameArea.getBoundingClientRect();
        const namekoWidth = kasa.style.width ? parseInt(kasa.style.width) : 30; // CSSから取得すべきだが簡易的に
        const namekoHeight = (kasa.style.height ? parseInt(kasa.style.height) : 25) + (jiku.style.height ? parseInt(jiku.style.height) : 15);

        const randomX = Math.random() * (gameAreaRect.width - namekoWidth);
        const randomY = Math.random() * (gameAreaRect.height - namekoHeight);
        namekoEl.style.left = randomX + 'px';
        namekoEl.style.top = randomY + 'px';

        namekoEl.addEventListener('click', () => harvestNameko(id));
        gameArea.appendChild(namekoEl);
        playSound(growSound);

        namekoElements[id] = namekoEl;
        namekoData[id] = {
            type: typeKey,
            stage: 0, // 0: small, 1: medium, 2: large (harvestable)
            timerId: null
        };
        growNameko(id); // 成長開始
    }

    function growNameko(id) {
        const data = namekoData[id];
        if (!data || data.stage >= NAMEKO_TYPES[data.type].growthTime.length) return; // 既に最大かデータなし

        const type = NAMEKO_TYPES[data.type];
        const el = namekoElements[id];

        clearTimeout(data.timerId); // 前のタイマーをクリア

        const growthDuration = type.growthTime[data.stage];
        data.timerId = setTimeout(() => {
            data.stage++;
            el.classList.remove('stage-small', 'stage-medium', 'stage-large');
            if (data.stage === 1) el.classList.add('stage-medium');
            else if (data.stage >= 2) el.classList.add('stage-large'); // 2以上は収穫可能

            if (data.stage < type.growthTime.length) {
                growNameko(id); // 次の成長段階へ
            }
        }, growthDuration);
    }

    function harvestNameko(id) {
        const data = namekoData[id];
        const el = namekoElements[id];
        if (!data || !el || data.stage < 2) return; // 成長途中は収穫不可

        const type = NAMEKO_TYPES[data.type];
        gameState.score += type.score;
        gameState.currentExp += type.score; // スコアを経験値として加算

        // 図鑑記録
        if (!gameState.zukan[data.type]) {
            gameState.zukan[data.type] = true;
            updateZukanDisplay();
        }

        playSound(type.sound);

        el.style.transform = 'scale(1.2)'; // 収穫アニメーション
        el.style.opacity = '0';
        setTimeout(() => {
            gameArea.removeChild(el);
        }, 300); // CSSのtransition時間と合わせる

        delete namekoElements[id];
        delete namekoData[id];

        updateScoreDisplay();
        checkLevelUp();
        saveGameState();
    }

    // --- ゲーム状態更新 ---
    function updateScoreDisplay() {
        scoreDisplay.textContent = gameState.score;
    }

    function checkLevelUp() {
        const requiredExp = gameState.expForNextLevel[gameState.logLevel] || Infinity;
        if (gameState.currentExp >= requiredExp) {
            gameState.logLevel++;
            gameState.currentExp -= requiredExp; // 次のレベルの経験値に持ち越し
            // alert(`原木レベルが ${gameState.logLevel} に上がりました！`);
            console.log(`原木レベルが ${gameState.logLevel} に上がりました！`);
        }
        updateLogLevelDisplay();
    }
    
    function updateLogLevelDisplay() {
        logLevelDisplay.textContent = gameState.logLevel;
        const requiredExp = gameState.expForNextLevel[gameState.logLevel] || "MAX";
        const remainingExp = requiredExp === "MAX" ? "MAX" : Math.max(0, requiredExp - gameState.currentExp);
        expToNextLevelDisplay.textContent = remainingExp;
    }

    // --- 図鑑機能 ---
    function updateZukanDisplay() {
        zukanList.innerHTML = ''; // 一旦クリア
        let collectedCount = 0;
        Object.keys(NAMEKO_TYPES).forEach(typeKey => {
            const type = NAMEKO_TYPES[typeKey];
            const itemEl = document.createElement('div');
            itemEl.classList.add('zukan-item');
            if (gameState.zukan[typeKey]) {
                itemEl.classList.add('collected');
                collectedCount++;
            }

            // 図鑑用プレビューなめこ (簡易)
            const previewEl = document.createElement('div');
            previewEl.classList.add('nameko', type.cssClass, 'nameko-preview', 'stage-large'); //常に大きい状態で表示
            const kasa = document.createElement('div');
            kasa.classList.add('nameko-kasa');
            const jiku = document.createElement('div');
            jiku.classList.add('nameko-jiku');
            const eyeL = document.createElement('div');
            eyeL.classList.add('nameko-eye', 'left');
            const eyeR = document.createElement('div');
            eyeR.classList.add('nameko-eye', 'right');
            kasa.appendChild(eyeL);
            kasa.appendChild(eyeR);
            previewEl.appendChild(kasa);
            previewEl.appendChild(jiku);

            const nameP = document.createElement('p');
            nameP.classList.add('nameko-name');
            nameP.textContent = type.name;
            const scoreP = document.createElement('p');
            scoreP.classList.add('nameko-score');
            scoreP.textContent = `Pt: ${type.score}`;

            itemEl.appendChild(previewEl);
            itemEl.appendChild(nameP);
            itemEl.appendChild(scoreP);
            zukanList.appendChild(itemEl);
        });
        zukanCollectedCountDisplay.textContent = collectedCount;
    }

    // --- データ保存・読み込み ---
    function saveGameState() {
        localStorage.setItem('namekoDeluxeGameState', JSON.stringify(gameState));
    }

    function loadGameState() {
        const savedState = localStorage.getItem('namekoDeluxeGameState');
        if (savedState) {
            const loaded = JSON.parse(savedState);
            // 互換性のため、キーごとに代入
            Object.keys(gameState).forEach(key => {
                if (loaded[key] !== undefined) {
                    gameState[key] = loaded[key];
                }
            });
             // 古いセーブデータにexpForNextLevelがない場合などの対処
            if (!gameState.expForNextLevel || gameState.expForNextLevel.length < 2) {
                 gameState.expForNextLevel = [0, 100, 250, 500, 1000];
            }
        }
         // Initialize zukan if not present in saved data
        Object.keys(NAMEKO_TYPES).forEach(typeKey => {
            if (gameState.zukan[typeKey] === undefined) {
                gameState.zukan[typeKey] = false;
            }
        });
    }

    resetDataButton.addEventListener('click', function() {
        if (confirm('本当にすべてのゲームデータをリセットしますか？（図鑑もリセットされます）')) {
            localStorage.removeItem('namekoDeluxeGameState');
            // gameStateを初期状態に戻す
            gameState.score = 0;
            gameState.logLevel = 1;
            gameState.currentExp = 0;
            gameState.zukan = {};
            Object.keys(NAMEKO_TYPES).forEach(typeKey => { gameState.zukan[typeKey] = false; });
            // gameState.bgmVolume = 0.5; // 音量はリセットしないでおくか、ユーザー設定に任せる
            // gameState.sfxVolume = 0.5;

            // 画面上のなめこもクリア
            Object.values(namekoElements).forEach(el => el.remove());
            namekoElements = {};
            Object.values(namekoData).forEach(data => clearTimeout(data.timerId));
            namekoData = {};

            initGame(); // 再初期化して表示を更新
        }
    });

    // --- ゲーム開始 ---
    initGame();
});