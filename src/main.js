import { vsSource, fsSource, createProgram, loadTexture } from './shaders.js';
import { Tower, Enemy } from './entity.js';
import { InputManager } from './input.js';
import { RhythmManager } from './audio.js';
import { getLevel } from './levels.js';
import { getVolume, setVolume, registerAudio, onVolumeChange } from './audio-settings.js';

// Música de fundo tocada enquanto o jogador está na tela de menu.
const MENU_THEME_URL = "assets/audio/menu-theme.mp3";
const menuTheme = registerAudio(new Audio(MENU_THEME_URL));
menuTheme.loop = true;

let gl, program;
let positionAttributeLocation, texcoordAttributeLocation;
let resolutionUniformLocation, translationUniformLocation, scaleUniformLocation, colorUniformLocation, useTextureUniformLocation;
let rotationUniformLocation, pivotUniformLocation;

let canvas;
let tower;
let enemies = [];
let shapeBuffers = {}; // 'square' | 'triangle' | 'diamond' | 'circle' -> { position, texcoord, count }

let lastTime = 0;
let score = 0;
let isGameOver = false;
let isGameStarted = false;
let isPaused = false;

// Laser: sai da torre e vai até o mouse (não mais até a borda da tela).
// O CORPO é só visual — não mata mais quem encostar. Só a PONTA (a
// bolinha desenhada na posição do mouse) é letal: qualquer inimigo que
// ela tocar morre na hora. mouseX/mouseY são atualizados a cada
// movimento do mouse (ver handleMouseMove).
const LASER_THICKNESS = 10;
const LASER_BODY_COLOR = [1.0, 0.75, 0.75, 1.0]; // corpo: tom claro, só decorativo
const LASER_TIP_COLOR = [1.0, 0.1, 0.1, 1.0];    // ponta: vermelho forte, é o que mata
const LASER_TIP_RADIUS = 14;
let mouseX = 0;
let mouseY = 0;
let currentLaser = { x1: 0, y1: 0, x2: 0, y2: 0 }; // calculado em update(), usado em gameLoop() pra desenhar

let currentLevel = null;
const rhythmManager = new RhythmManager();

// 8 pontos fixos e igualmente espaçados em cada lado da tela, usados
// em ordem cíclica (0, 1, 2, ..., 7, 0, 1, ...) a cada spawn daquele lado.
const SPAWN_POINTS_PER_SIDE = 8;
let nextSpawnIndexBySide = [0, 0, 0, 0]; // [cima, direita, baixo, esquerda]

// Elementos da HUD
const hpElement = document.getElementById("hp-val");
const scoreElement = document.getElementById("score-val");
const gameOverScreen = document.getElementById("game-over");
const finalScoreElement = document.getElementById("final-score");
const restartBtn = document.getElementById("restart-btn");
const menuScreen = document.getElementById("menu-screen");
const level1Btn = document.getElementById("level1-btn");
const pauseBtn = document.getElementById("pause-btn");
const pauseScreen = document.getElementById("pause-screen");
const resumeBtn = document.getElementById("resume-btn");
const pauseMenuBtn = document.getElementById("pause-menu-btn");
const menuBtn = document.getElementById("menu-btn");

// Cria os buffers de posição/texcoord para uma forma geométrica, a
// partir de uma lista plana de vértices [x0,y0, x1,y1, ...] dentro do
// quadrado unitário. O texcoord não é usado (inimigos não têm textura),
// mas o shader espera o atributo preenchido, então reaproveitamos os
// mesmos valores de posição.
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

// Gera os triângulos (em leque) que aproximam um círculo dentro do
// quadrado unitário, centrado em (0.5, 0.5) com raio 0.5.
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

function init() {
    canvas = document.getElementById("glcanvas");
    gl = canvas.getContext("webgl2");

    if (!gl) {
        alert("WebGL 2 não é suportado!");
        return;
    }

    program = createProgram(gl, vsSource, fsSource);
    gl.useProgram(program);

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

    // Formas geométricas dos inimigos: cada uma é um conjunto de
    // triângulos dentro do quadrado unitário [0,1]x[0,1], igual ao
    // buffer padrão acima, só que com vértices diferentes.
    shapeBuffers.square = { position: positionBuffer, texcoord: texcoordBuffer, count: 6 };
    shapeBuffers.triangle = createShapeBuffers(gl, [
        0.5, 0,  0, 1,  1, 1,
    ]);
    shapeBuffers.diamond = createShapeBuffers(gl, [
        0.5, 0,  1, 0.5,  0.5, 1,
        0.5, 0,  0.5, 1,  0, 0.5,
    ]);
    shapeBuffers.circle = createShapeBuffers(gl, generateCircleVertices(20));

    // Redimensiona o canvas para a tela toda
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    new InputManager(canvas, () => {}, handleMouseMove);
    restartBtn.addEventListener("click", restartLevel);
    level1Btn.addEventListener("click", () => startLevel(1));
    // Níveis 2 a 4 ainda não fazem nada (bloqueados por enquanto)

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

// Toca a música de fundo da tela inicial (com tratamento para o caso
// do navegador bloquear o autoplay antes do primeiro clique do usuário).
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

// Botão de volume (existe na tela inicial e na tela de pause): clique
// abre/fecha o painel com o slider, e o slider altera o volume de TODO
// áudio do site (música do menu, música do nível, etc.), já que ambos
// passam por audio-settings.js. As duas instâncias ficam sincronizadas.
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
    resetGame();
    menuScreen.style.display = "flex";
    playMenuTheme();
}

function startLevel(levelNumber) {
    currentLevel = getLevel(levelNumber);
    if (!currentLevel) return;

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
    if (!isGameStarted || isGameOver || isPaused) return;
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
    isPaused = false;

    // Laser começa apontando pra cima até o mouse se mexer
    mouseX = tower.x;
    mouseY = tower.y - 100;

    gameOverScreen.style.display = "none";
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

// Guarda a posição do mouse (em coordenadas do canvas) pra usar como
// direção do laser contínuo da torre (ver update() e drawLaser()).
function handleMouseMove(x, y) {
    mouseX = x;
    mouseY = y;
}

// Cada instrumento nasce sempre do mesmo lado da tela: 1 = cima,
// 2 = direita, 3 = baixo, 4 = esquerda. Dentro daquele lado, a posição
// segue 8 pontos fixos e igualmente espaçados, percorridos sempre no
// mesmo sentido: topo (esquerda -> direita), direita (cima -> baixo),
// baixo (direita -> esquerda), esquerda (baixo -> cima).
function spawnEnemy(instrument = 1) {
    const side = (instrument - 1) % 4; // 0=cima, 1=direita, 2=baixo, 3=esquerda

    // Fração (0 a 1) ao longo do lado: divide o lado em 8 segmentos
    // iguais e usa o centro de cada um, na ordem cíclica atual.
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
    if (isGameOver || !isGameStarted || isPaused) return;

    rhythmManager.update(); // dispara spawnEnemy() nos tempos do beatmap

    // O laser vai da torre até o mouse (não mais até a borda da tela).
    currentLaser = { x1: tower.x, y1: tower.y, x2: mouseX, y2: mouseY };

    // Só a PONTA do laser (a bolinha na posição do mouse) mata — o
    // corpo do laser é só visual e não causa mais dano.
    enemies.forEach(enemy => {
        if (!enemy.active) return;

        const hitDistance = LASER_TIP_RADIUS + Math.max(enemy.width, enemy.height) / 2;
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
}

// Desenha uma forma com controle total de transformação: translação,
// escala, rotação (radianos) e pivô (em coordenadas do quadrado
// unitário, 0..1). drawRect() e drawLaser() usam isso por baixo.
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

// Retângulo alinhado aos eixos, centrado em (x, y) — comportamento
// idêntico ao de antes (pivô no canto, sem rotação).
function drawRect(x, y, width, height, color, shape = "square", texture = null) {
    drawShape(shape, x - width / 2, y - height / 2, width, height, 0, 0, 0, color, texture);
}

// Desenha o laser como um retângulo fino rotacionado, indo de (x1,y1)
// até (x2,y2). O pivô fica no meio da borda esquerda do quadrado
// unitário (0, 0.5), que é o ponto onde o laser "sai" da torre.
function drawLaser(x1, y1, x2, y2, thickness, color) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return;

    const angle = Math.atan2(dy, dx);
    drawShape("square", x1, y1, length, thickness, angle, 0, 0.5, color);
}

function gameLoop(timestamp) {
    let deltaTime = (timestamp - lastTime) / 1000;
    if (isNaN(deltaTime)) deltaTime = 0;
    lastTime = timestamp;

    update(deltaTime);

    gl.clearColor(0.05, 0.05, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (tower.hp > 0) {
        drawRect(tower.x, tower.y, tower.width, tower.height, tower.color, "square");

        if (isGameStarted && !isGameOver && !isPaused) {
            // Corpo do laser: só visual, desenhado atrás dos inimigos
            drawLaser(currentLaser.x1, currentLaser.y1, currentLaser.x2, currentLaser.y2, LASER_THICKNESS, LASER_BODY_COLOR);
        }
    }

    enemies.forEach(e => drawRect(e.x, e.y, e.width, e.height, e.color, e.shape));

    if (isGameStarted && !isGameOver && !isPaused) {
        // Ponta do laser: desenhada por cima de tudo, deixando claro que
        // só ela é letal (o corpo, atrás dos inimigos, não causa dano)
        drawRect(currentLaser.x2, currentLaser.y2, LASER_TIP_RADIUS * 2, LASER_TIP_RADIUS * 2, LASER_TIP_COLOR, "circle");
    }

    requestAnimationFrame(gameLoop);
}

window.onload = init;