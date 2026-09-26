import { vsSource, fsSource, createProgram, loadTexture } from './shaders.js';
import { Tower, Enemy } from './entity.js';
import { InputManager } from './input.js';
import { RhythmManager } from './audio.js';
import { getLevel, LEVELS } from './levels.js';
import { getVolume, setVolume, registerAudio, onVolumeChange } from './audio-settings.js';

// Música de fundo da tela de menu.
const MENU_THEME_URL = "assets/audio/menu-theme.mp3";
const menuTheme = registerAudio(new Audio(MENU_THEME_URL));
menuTheme.loop = true;

// Váriaveis do contexto WEBGL
let gl, program;
let positionAttributeLocation, texcoordAttributeLocation;
let resolutionUniformLocation, translationUniformLocation, scaleUniformLocation, colorUniformLocation, useTextureUniformLocation;
let rotationUniformLocation, pivotUniformLocation;
 
// Variáveis dos elementos do jogo.
let canvas;
let tower;
let enemies = [];
let shapeBuffers = {}; // 'square' | 'triangle' | 'diamond' | 'circle' -> { position, texcoord, count }
let altarTexture;
let flameTexture;
let backgroundTexture;

const textureCache = {};

//Dimensão visual do sprite da torre (maior que a hitbox real de colisão).
const TOWER_SPRITE_SIZE = 180;

//// Parâmetros para recortar e posicionar a chama animada sobre a base do altar.
const ALTAR_IMAGE_SIZE = 1254;
const FLAME_CROP = { x1: 280, y1: 55, x2: 970, y2: 490 };
const FLAME_NORM = {
    centerX: (FLAME_CROP.x1 + FLAME_CROP.x2) / 2 / ALTAR_IMAGE_SIZE,
    bottomY: FLAME_CROP.y2 / ALTAR_IMAGE_SIZE,
    width: (FLAME_CROP.x2 - FLAME_CROP.x1) / ALTAR_IMAGE_SIZE,
    height: (FLAME_CROP.y2 - FLAME_CROP.y1) / ALTAR_IMAGE_SIZE,
};

// Variáveis de estado e tempo do jogo
let lastTime = 0;
let score = 0;
let isGameOver = false;
let isGameWon = false;
let isGameStarted = false;
let isPaused = false;

// Coloquei 2 segundos como delay para confirmar a vitória após a música terminar.
const VICTORY_DELAY = 2;
let victoryTimer = 0;

// Parâmetros do feixe de energia que sai da torre, usado pra matar inimigos. 
const DEFAULT_ENERGY_COLORS = {
    core: [1.0, 0.95, 0.55, 1.0],
    mid: [1.0, 0.55, 0.15, 1.0],
    glow: [1.0, 0.25, 0.05, 1.0],
};
let currentEnergyColors = DEFAULT_ENERGY_COLORS;
const ENERGY_TIP_RADIUS = 14; // Raio da área letal da ponta do feixe no mouse
let mouseX = 0;
let mouseY = 0;
let currentLaser = { x1: 0, y1: 0, x2: 0, y2: 0 }; 

let currentLevel = null;
const rhythmManager = new RhythmManager();

// Configuração dos pontos de nascimento (spawn) dos inimigos nas 4 bordas da tela.
const SPAWN_POINTS_PER_SIDE = 8;
let nextSpawnIndexBySide = [0, 0, 0, 0]; // [cima, direita, baixo, esquerda]

// Elementos da HUD
const hpElement = document.getElementById("hp-val");
const scoreElement = document.getElementById("score-val");
const gameOverScreen = document.getElementById("game-over");
const finalScoreElement = document.getElementById("final-score");
const restartBtn = document.getElementById("restart-btn");
const victoryScreen = document.getElementById("victory-screen");
const finalScoreWinElement = document.getElementById("final-score-win");
const restartWinBtn = document.getElementById("restart-win-btn");
const menuWinBtn = document.getElementById("menu-win-btn");
const menuScreen = document.getElementById("menu-screen");
const levelButtons = [1, 2, 3, 4].map(id => ({ id, button: document.getElementById(`level${id}-btn`) }));
const pauseBtn = document.getElementById("pause-btn");
const pauseScreen = document.getElementById("pause-screen");
const resumeBtn = document.getElementById("resume-btn");
const pauseMenuBtn = document.getElementById("pause-menu-btn");
const menuBtn = document.getElementById("menu-btn");

// Cría os buffers de posição e textura WebGL para vértices geométricos customizados.
function createShapeBuffers(gl, vertices) {
    const data = new Float32Array(vertices);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    return { position: positionBuffer, texcoord: texcoordBuffer, count: vertices.length / 2 };
}

// Gera vértices triangulados para criar uma aproximação de círculo.
function generateCircleVertices(segments = 20) {
    const verts = [];
    const cx = 0.5, cy = 0.5, r = 0.5;
    for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        verts.push(cx, cy);
        verts.push(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
        verts.push(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    }
    return verts;
}

// Gera formas orgânicas e curvas ("blobs") através de interpolação spline Catmull-Rom.
function generateBlobVertices(controlRadii, segments = 48) {
    const cx = 0.5, cy = 0.5;
    const n = controlRadii.length;

    // Função para cálculo de curva Catmull-Rom entre pontos
    function catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t, t3 = t2 * t;
        return 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
    }

    const outline = [];
    for (let i = 0; i < segments; i++) {
        const f = (i / segments) * n; // posição contínua entre os pontos de controle
        const idx = Math.floor(f);
        const t = f - idx;
        const p0 = controlRadii[(idx - 1 + n) % n];
        const p1 = controlRadii[idx % n];
        const p2 = controlRadii[(idx + 1) % n];
        const p3 = controlRadii[(idx + 2) % n];
        const r = catmullRom(p0, p1, p2, p3, t);
        const angle = (i / segments) * Math.PI * 2;
        outline.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
    }

    const verts = [];
    for (let i = 0; i < segments; i++) {
        const a = outline[i];
        const b = outline[(i + 1) % segments];
        verts.push(cx, cy, a[0], a[1], b[0], b[1]);
    }
    return verts;
}

// Retorna uma textura do cache ou realiza o carregamento caso não exista.
function getCachedTexture(url) {
    if (!textureCache[url]) {
        textureCache[url] = loadTexture(gl, url);
    }
    return textureCache[url];
}

// Atualiza as texturas ativas (altar, chama, fundo) e as cores do laser para o nível selecionado.
function loadLevelTextures(level) {
    const { altarBase, flame, background } = level.textures;
    altarTexture = getCachedTexture(altarBase);
    flameTexture = getCachedTexture(flame);
    backgroundTexture = getCachedTexture(background);
    currentEnergyColors = level.energyColors || DEFAULT_ENERGY_COLORS;
}

// Redimensiona o canvas para preencher a janela e recalcula a viewport WebGL e posição da torre.
function resizeCanvas() {
    if (!canvas || !gl) return;

    // Ajusta tamanho do canvas para tamanho da tela
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Atualiza a viewport do WebGL e a uniform de resolução
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (program) {
        gl.useProgram(program);
        gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
    }

    // Reposiciona a torre no novo centro da tela
    if (tower) {
        tower.x = canvas.width / 2;
        tower.y = canvas.height / 2;
    }
}

// Inicializa a aplicação, shaders, buffers, escutadores de eventos e inicia a execução.
function init() {
    canvas = document.getElementById("glcanvas");
    gl = canvas.getContext("webgl2");

    if (!gl) {
        alert("WebGL 2 não é suportado!");
        return;
    }

    program = createProgram(gl, vsSource, fsSource);
    gl.useProgram(program);

    // Necessário pra texturas com transparência (ex: a imagem da torre)
    // não aparecerem com fundo preto/opaco.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    texcoordAttributeLocation = gl.getAttribLocation(program, "a_texcoord");

    resolutionUniformLocation = gl.getUniformLocation(program, "u_resolution");
    translationUniformLocation = gl.getUniformLocation(program, "u_translation");
    scaleUniformLocation = gl.getUniformLocation(program, "u_scale");
    colorUniformLocation = gl.getUniformLocation(program, "u_color");
    useTextureUniformLocation = gl.getUniformLocation(program, "u_useTexture");
    rotationUniformLocation = gl.getUniformLocation(program, "u_rotation");
    pivotUniformLocation = gl.getUniformLocation(program, "u_pivot");

    // Buffer de Posições (Vértices)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 0,  1, 0,  0, 1,
        0, 1,  1, 0,  1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Buffer de UVs (Texturas)
    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 0,  1, 0,  0, 1,
        0, 1,  1, 0,  1, 1,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texcoordAttributeLocation);
    gl.vertexAttribPointer(texcoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    shapeBuffers.square = { position: positionBuffer, texcoord: texcoordBuffer, count: 6 };
    shapeBuffers.triangle = createShapeBuffers(gl, [
        0.5, 0,  0, 1,  1, 1,
    ]);
    shapeBuffers.diamond = createShapeBuffers(gl, [
        0.5, 0,  1, 0.5,  0.5, 1,
        0.5, 0,  0.5, 1,  0, 0.5,
    ]);
    shapeBuffers.circle = createShapeBuffers(gl, generateCircleVertices(20));

    shapeBuffers.blob = createShapeBuffers(gl, generateBlobVertices([0.46, 0.40, 0.44, 0.38, 0.46, 0.40, 0.44, 0.38]));
    shapeBuffers.petalPointy = createShapeBuffers(gl, generateBlobVertices([0.40, 0.24, 0.10, 0.24, 0.40, 0.30, 0.20, 0.30]));
    shapeBuffers.petalLong = createShapeBuffers(gl, generateBlobVertices([0.28, 0.18, 0.08, 0.18, 0.28, 0.34, 0.44, 0.34]));
    shapeBuffers.waveBlob = createShapeBuffers(gl, generateBlobVertices([0.42, 0.22, 0.42, 0.22, 0.42, 0.22, 0.42, 0.22]));

    loadLevelTextures(LEVELS[0]);

    // Redimensiona o canvas para a tela toda
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    new InputManager(canvas, () => {}, handleMouseMove);
    restartBtn.addEventListener("click", restartLevel);
    restartWinBtn.addEventListener("click", restartLevel);
    menuWinBtn.addEventListener("click", backToMenu);
    
    // Desbloqueia os níveis 
    levelButtons.forEach(({ button, id }) => {
        if (getLevel(id)?.unlocked) {
            button.addEventListener("click", () => startLevel(id));
        }
    });

    pauseBtn.addEventListener("click", pauseGame);
    resumeBtn.addEventListener("click", resumeGame);
    pauseMenuBtn.addEventListener("click", backToMenu);
    menuBtn.addEventListener("click", backToMenu);

    // Pausa automaticamente ao minimizar a janela ou trocar de aba
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) pauseGame();
    });

    // A cada instante marcado no beatmap, spawna o inimigo daquele instrumento
    rhythmManager.onInstrumentPlay((instrument) => {
        if (isGameStarted && !isGameOver) spawnEnemy(instrument);
    });

    initVolumeControl();
    resetGame();
    playMenuTheme();
    requestAnimationFrame(gameLoop);
}

// Inicia a música do menu tratando políticas de bloqueio de autoplay do navegador.
function playMenuTheme() {
    const playPromise = menuTheme.play();
    if (playPromise !== undefined) {
        playPromise.catch(() => {
            const tryAgain = () => {
                menuTheme.play().catch(() => {});
                document.removeEventListener("pointerdown", tryAgain);
                document.removeEventListener("keydown", tryAgain);
            };
            document.addEventListener("pointerdown", tryAgain, { once: true });
            document.addEventListener("keydown", tryAgain, { once: true });
        });
    }
}

function pauseMenuTheme() {
    menuTheme.pause();
}

// Botão de volume (existe na tela inicial e na tela de pause)
function initVolumeControl() {
    const volumeControls = document.querySelectorAll(".volume-control");
    const percent = Math.round(getVolume() * 100);

    volumeControls.forEach((control) => {
        const btn = control.querySelector(".volume-btn");
        const panel = control.querySelector(".volume-panel");
        const slider = control.querySelector(".volume-slider");

        slider.value = String(percent);
        updateVolumeIcon(btn, getVolume());

        btn.addEventListener("click", (event) => {
            event.stopPropagation();
            panel.classList.toggle("open");
        });

        slider.addEventListener("input", (event) => {
            setVolume(Number(event.target.value) / 100);
        });
    });

    // Fecha qualquer painel aberto se o jogador clicar fora dele
    document.addEventListener("click", (event) => {
        volumeControls.forEach((control) => {
            if (!control.contains(event.target)) {
                control.querySelector(".volume-panel").classList.remove("open");
            }
        });
    });

    // Mantém todas as instâncias (menu e pause) sincronizadas entre si
    onVolumeChange((volume) => {
        volumeControls.forEach((control) => {
            control.querySelector(".volume-slider").value = String(Math.round(volume * 100));
            updateVolumeIcon(control.querySelector(".volume-btn"), volume);
        });
    });
}

function updateVolumeIcon(btn, volume) {
    btn.textContent = volume <= 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊";
}

// Fecha o Game Over/Pause e volta para a tela de seleção de nível.
function backToMenu() {
    rhythmManager.stop();
    isGameStarted = false;
    loadLevelTextures(LEVELS[0]); 
    resetGame();
    menuScreen.style.display = "flex";
    playMenuTheme();
}

function startLevel(levelNumber) {
    currentLevel = getLevel(levelNumber);
    if (!currentLevel) return;

    loadLevelTextures(currentLevel);
    resetGame();
    isGameStarted = true;
    menuScreen.style.display = "none";
    pauseMenuTheme();

    rhythmManager.loadTrack(currentLevel.musicUrl);
    rhythmManager.loadBeatmap(currentLevel.beatmap);
    rhythmManager.play();
}

// Reinicia o nível em andamento (usado pelo botão "Jogar Novamente")
function restartLevel() {
    if (currentLevel) {
        startLevel(currentLevel.id);
    } else {
        resetGame();
    }
}

function pauseGame() {
    if (!isGameStarted || isGameOver || isGameWon || isPaused) return;
    isPaused = true;
    rhythmManager.pause();
    pauseScreen.style.display = "flex";
}

function resumeGame() {
    if (!isPaused) return;
    isPaused = false;
    rhythmManager.resume();
    pauseScreen.style.display = "none";
}

function resetGame() {
    tower = new Tower(canvas.width / 2, canvas.height / 2);
    if (currentLevel) {
        tower.hp = currentLevel.towerHp;
        tower.maxHp = currentLevel.towerHp;
    }
    enemies = [];
    nextSpawnIndexBySide = [0, 0, 0, 0];
    score = 0;
    isGameOver = false;
    isGameWon = false;
    isPaused = false;
    victoryTimer = 0;

    // Laser começa apontando pra cima até o mouse se mexer
    mouseX = tower.x;
    mouseY = tower.y - 100;

    gameOverScreen.style.display = "none";
    victoryScreen.style.display = "none";
    pauseScreen.style.display = "none";
    updateHUD();
}

function updateHUD() {
    hpElement.textContent = Math.max(0, tower.hp);
    scoreElement.textContent = score;
}

function triggerGameOver() {
    isGameOver = true;
    rhythmManager.stop();
    finalScoreElement.textContent = score;
    gameOverScreen.style.display = "flex";
}

// Condição de vitória
function triggerVictory() {
    isGameWon = true;
    rhythmManager.stop();
    finalScoreWinElement.textContent = score;
    victoryScreen.style.display = "flex";
}

// Guarda a posição do mouse 
function handleMouseMove(x, y) {
    mouseX = x;
    mouseY = y;
}

function spawnEnemy(instrument = 1) {
    const side = (instrument - 1) % 4; // 0=cima, 1=direita, 2=baixo, 3=esquerda

    const pointIndex = nextSpawnIndexBySide[side];
    const fraction = (pointIndex + 0.5) / SPAWN_POINTS_PER_SIDE;
    nextSpawnIndexBySide[side] = (pointIndex + 1) % SPAWN_POINTS_PER_SIDE;

    let x, y;
    if (side === 0) { x = fraction * canvas.width; y = -30; }                             // Topo: esquerda -> direita
    else if (side === 1) { x = canvas.width + 30; y = fraction * canvas.height; }         // Direita: cima -> baixo
    else if (side === 2) { x = (1 - fraction) * canvas.width; y = canvas.height + 30; }   // Baixo: direita -> esquerda
    else { x = -30; y = (1 - fraction) * canvas.height; }                                 // Esquerda: baixo -> cima

    enemies.push(new Enemy(x, y, instrument));
}

function update(deltaTime) {
    if (isGameOver || isGameWon || !isGameStarted || isPaused) return;

    rhythmManager.update(); // dispara spawnEnemy() nos tempos do beatmap

    // O feixe vai da torre até o mouse (não mais até a borda da tela).
    currentLaser = { x1: tower.x, y1: tower.y, x2: mouseX, y2: mouseY };

    // Só a PONTA do feixe (a bolinha na posição do mouse) mata o inimigo
    enemies.forEach(enemy => {
        if (!enemy.active) return;

        const hitDistance = ENERGY_TIP_RADIUS + Math.max(enemy.width, enemy.height) / 2;
        const distanceToTip = Math.hypot(enemy.x - mouseX, enemy.y - mouseY);

        if (distanceToTip < hitDistance) {
            enemy.active = false;
            score += 10;
            updateHUD();
        }
    });

    enemies.forEach(enemy => {
        enemy.update(deltaTime, tower.x, tower.y);

        const dist = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
        if (dist < 35 && enemy.active) {
            tower.hp -= 10;
            enemy.active = false;
            updateHUD();

            if (tower.hp <= 0) {
                triggerGameOver();
            }
        }
    });

    enemies = enemies.filter(e => e.active);

    // Vitória
    if (rhythmManager.isTrackEnded() && enemies.length === 0) {
        victoryTimer += deltaTime;
        if (victoryTimer >= VICTORY_DELAY) {
            triggerVictory();
        }
    } else {
        victoryTimer = 0;
    }
}

// Desenha uma forma com controle total de transformação
function drawShape(shape, translationX, translationY, scaleX, scaleY, rotation, pivotX, pivotY, color, texture = null) {
    const buffers = shapeBuffers[shape] || shapeBuffers.square;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
    gl.vertexAttribPointer(texcoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(translationUniformLocation, translationX, translationY);
    gl.uniform2f(scaleUniformLocation, scaleX, scaleY);
    gl.uniform1f(rotationUniformLocation, rotation);
    gl.uniform2f(pivotUniformLocation, pivotX, pivotY);

    if (texture) {
        gl.uniform1i(useTextureUniformLocation, 1);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    } else {
        gl.uniform1i(useTextureUniformLocation, 0);
        gl.uniform4fv(colorUniformLocation, color);
    }

    gl.drawArrays(gl.TRIANGLES, 0, buffers.count);
}

// Desenha um retângulo (ou quadrado) com centro em (x,y), largura e altura, cor e textura opcional.
function drawRect(x, y, width, height, color, shape = "square", texture = null) {
    drawShape(shape, x - width / 2, y - height / 2, width, height, 0, 0, 0, color, texture);
}

// Aplica um alfa diferente a uma cor [r,g,b,a] sem alterar a original.
function withAlpha(color, alpha) {
    return [color[0], color[1], color[2], alpha];
}

// Calcula os pontos do feixe de energia em zigue-zague entre (x1,y1) e (x2,y2), com base no tempo atual.
function computeZigzagPoints(x1, y1, x2, y2, time, segments = 8, amplitude = 12) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];

    const ux = dx / length, uy = dy / length;   // direção do feixe
    const px = -uy, py = ux;                    // perpendicular à direção

    const points = [];
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        let offset = 0;
        if (i > 0 && i < segments) {
            const wiggle = Math.sin(time * 14 + i * 2.1) * amplitude
                + Math.sin(time * 23 + i * 3.7) * amplitude * 0.4;
            const taper = Math.sin(t * Math.PI); // 0 nas pontas, 1 no meio
            offset = wiggle * taper;
        }
        points.push({
            x: x1 + ux * length * t + px * offset,
            y: y1 + uy * length * t + py * offset,
        });
    }
    return points;
}

// Desenha um segmento do feixe em três camadas sobrepostas 
function drawGlowSegment(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return;

    const angle = Math.atan2(dy, dx);
    drawShape("square", x1, y1, length, 24, angle, 0, 0.5, withAlpha(currentEnergyColors.glow, 0.18));
    drawShape("square", x1, y1, length, 10, angle, 0, 0.5, withAlpha(currentEnergyColors.mid, 0.55));
    drawShape("square", x1, y1, length, 3.5, angle, 0, 0.5, withAlpha(currentEnergyColors.core, 0.95));
}

// O feixe completo: liga os pontos do zigue-zague segmento a segmento.
function drawEnergyBeam(x1, y1, x2, y2, time) {
    const points = computeZigzagPoints(x1, y1, x2, y2, time);
    for (let i = 0; i < points.length - 1; i++) {
        drawGlowSegment(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
    }
}

// Explosão de faíscas na origem do feixe (base da torre)
function drawEnergyBurst(x, y, time) {
    drawShape("circle", x, y, 26, 26, 0, 0.5, 0.5, withAlpha(currentEnergyColors.glow, 0.4));
    drawShape("circle", x, y, 14, 14, 0, 0.5, 0.5, currentEnergyColors.core);

    const spikeCount = 8;
    for (let i = 0; i < spikeCount; i++) {
        const angle = (i / spikeCount) * Math.PI * 2;
        const flicker = 0.6 + 0.4 * Math.sin(time * 9 + i * 1.7);
        const len = 32 * flicker;
        const width = 7 * (0.5 + 0.5 * flicker);
        drawShape("diamond", x, y, len, width, angle, 0, 0.5, withAlpha(currentEnergyColors.mid, 0.85));
    }
}

// Ponta do feixe: uma bolinha brilhante 
function drawEnergyTip(x, y) {
    drawShape("circle", x, y, ENERGY_TIP_RADIUS * 2.4, ENERGY_TIP_RADIUS * 2.4, 0, 0.5, 0.5, withAlpha(currentEnergyColors.glow, 0.35));
    drawShape("circle", x, y, ENERGY_TIP_RADIUS * 1.4, ENERGY_TIP_RADIUS * 1.4, 0, 0.5, 0.5, withAlpha(currentEnergyColors.mid, 0.9));
    drawShape("circle", x, y, ENERGY_TIP_RADIUS * 0.7, ENERGY_TIP_RADIUS * 0.7, 0, 0.5, 0.5, currentEnergyColors.core);
}

// Desenha a chama do altar por cima da base, animada
function drawTowerFlame(time) {
    const flameCenterX = tower.x + TOWER_SPRITE_SIZE * (FLAME_NORM.centerX - 0.5);
    const flameBottomY = tower.y - TOWER_SPRITE_SIZE / 2 + FLAME_NORM.bottomY * TOWER_SPRITE_SIZE;
    const baseWidth = FLAME_NORM.width * TOWER_SPRITE_SIZE;
    const baseHeight = FLAME_NORM.height * TOWER_SPRITE_SIZE;

    const sway = Math.sin(time * 4.2) * 0.05 + Math.sin(time * 7.3) * 0.02;
    const pulse = 1 + Math.sin(time * 6) * 0.05;

    drawShape(
        "square",
        flameCenterX, flameBottomY,
        baseWidth * pulse, baseHeight * pulse,
        sway, 0.5, 1.0,
        [1, 1, 1, 1], flameTexture
    );
}

// Estilos de bichinhos inimigos, cada um com corpo, orelhas/chifres e instrumento diferentes.
const CRITTER_STYLES = {
    1: { // coelho com pandeiro
        bodyColor: [0.95, 0.15, 0.10, 1.0],
        accentColor: [0.65, 0.05, 0.03, 1.0],
        ears: { shape: "petalLong", w: 0.32, h: 0.62, forward: 0.10, spread: 0.20, tilt: 0.35 },
        instrument: { shape: "blob", w: 0.5, h: 0.5, forward: 0.62, side: 0.05 },
    },
    2: { // raposa com trompete
        bodyColor: [1.0, 0.75, 0.15, 1.0],
        accentColor: [0.85, 0.45, 0.05, 1.0],
        ears: { shape: "petalPointy", w: 0.30, h: 0.36, forward: 0.05, spread: 0.24, tilt: 0.5 },
        instrument: { shape: "petalPointy", w: 0.85, h: 0.40, forward: 0.70, side: 0, rotationExtra: 1.4 },
    },
    3: { // urso com violão
        bodyColor: [0.35, 0.75, 1.0, 1.0],
        accentColor: [0.10, 0.40, 0.70, 1.0],
        ears: { shape: "blob", w: 0.24, h: 0.24, forward: -0.05, spread: 0.26, tilt: 0 },
        instrument: { shape: "waveBlob", w: 0.55, h: 0.8, forward: 0.55, side: 0.05, rotationExtra: 0.5 },
    },
    4: { // cabra com sanfona
        bodyColor: [0.75, 0.40, 1.0, 1.0],
        accentColor: [0.45, 0.15, 0.70, 1.0],
        ears: { shape: "petalPointy", w: 0.20, h: 0.50, forward: 0.05, spread: 0.18, tilt: 0.9 }, // chifres
        instrument: { shape: "waveBlob", w: 0.5, h: 0.5, forward: 0.60, side: 0 },
    },
};

// Desenha uma forma com contorno por baixo, usando escala e cor diferentes.
const OUTLINE_SCALE = 1.16;
const OUTLINE_COLOR = [0.07, 0.05, 0.09, 1.0];

function drawOutlined(shape, x, y, w, h, angle, color) {
    drawShape(shape, x, y, w * OUTLINE_SCALE, h * OUTLINE_SCALE, angle, 0.5, 0.5, OUTLINE_COLOR);
    drawShape(shape, x, y, w, h, angle, 0.5, 0.5, color);
}

// Desenha um inimigo como um bichinho segurando um instrumento
function drawEnemyCritter(enemy, time) {
    const style = CRITTER_STYLES[enemy.instrument] || CRITTER_STYLES[1];
    const size = Math.max(enemy.width, enemy.height);
    const angle = enemy.angle || 0;
    const c = Math.cos(angle), s = Math.sin(angle);

    function toWorld(forward, side, refSize = size) {
        return [
            enemy.x + (forward * c - side * s) * refSize,
            enemy.y + (forward * s + side * c) * refSize,
        ];
    }

    const cycle = time * 7 + (enemy.animPhase || 0);
    const squash = 1 + Math.sin(cycle) * 0.06;
    const stretch = 1 - Math.sin(cycle) * 0.06;
    const hop = Math.max(0, Math.sin(cycle)) * size * 0.06;
    const bodyY = enemy.y - hop;

    drawOutlined("blob", enemy.x, bodyY, size * squash, size * stretch, angle, style.bodyColor);

    const [headX, headY] = toWorld(0.30, 0);
    const headSize = size * 0.62;
    drawOutlined("blob", headX, headY - hop, headSize, headSize, angle, style.bodyColor);

    const eyeSize = headSize * 0.22;
    [-1, 1].forEach(side => {
        const [ex, ey] = toWorld(0.30 + 0.22, side * 0.26, headSize);
        const eyeY = ey - hop;
        drawShape("circle", ex, eyeY, eyeSize, eyeSize, 0, 0.5, 0.5, [0.05, 0.05, 0.08, 1.0]);
        drawShape("circle", ex + eyeSize * 0.28, eyeY - eyeSize * 0.28, eyeSize * 0.4, eyeSize * 0.4, 0, 0.5, 0.5, [1, 1, 1, 1]);
    });

    const e = style.ears;
    [-1, 1].forEach(side => {
        const [ex, ey] = toWorld(0.30 + e.forward, side * e.spread);
        const wiggle = Math.sin(cycle * 1.3 + side) * 0.08;
        drawOutlined(e.shape, ex, ey - hop, size * e.w, size * e.h, angle + side * e.tilt + wiggle, style.accentColor);
    });

    const inst = style.instrument;
    const [ix, iy] = toWorld(inst.forward, inst.side || 0);
    drawOutlined(inst.shape, ix, iy - hop, size * inst.w, size * inst.h, angle + (inst.rotationExtra || 0), style.accentColor);
}

function gameLoop(timestamp) {
    let deltaTime = (timestamp - lastTime) / 1000;
    if (isNaN(deltaTime)) deltaTime = 0;
    lastTime = timestamp;

    update(deltaTime);

    gl.clearColor(0.05, 0.05, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Fundo (esticado pra cobrir a tela toda), desenhado antes de tudo o resto
    drawShape("square", 0, 0, canvas.width, canvas.height, 0, 0, 0, [1, 1, 1, 1], backgroundTexture);

    if (tower.hp > 0) {
        drawRect(tower.x, tower.y, TOWER_SPRITE_SIZE, TOWER_SPRITE_SIZE, tower.color, "square", altarTexture);
        drawTowerFlame(timestamp / 1000);

        if (isGameStarted && !isGameOver && !isGameWon && !isPaused) {
            // Feixe: desenhado atrás dos inimigos, com a explosão de
            // faíscas na origem (torre) por cima dele.
            drawEnergyBeam(currentLaser.x1, currentLaser.y1, currentLaser.x2, currentLaser.y2, timestamp / 1000);
            drawEnergyBurst(currentLaser.x1, currentLaser.y1, timestamp / 1000);
        }
    }

    enemies.forEach(e => drawEnemyCritter(e, timestamp / 1000));

    if (isGameStarted && !isGameOver && !isGameWon && !isPaused) {
        // Ponta do feixe: desenhada por cima de tudo, deixando claro que
        // só ela é letal (o corpo, atrás dos inimigos, não causa dano)
        drawEnergyTip(currentLaser.x2, currentLaser.y2);
    }

    requestAnimationFrame(gameLoop);
}

window.onload = init;