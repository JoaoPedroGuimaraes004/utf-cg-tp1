// Configuração central de cada nível: música, beatmap, dificuldade e tema visual.

import { nivel1Beatmap } from './beatmaps/nivel1.js';
import { nivel2Beatmap } from './beatmaps/nivel2.js';
import { nivel3Beatmap } from './beatmaps/nivel3.js';
import { nivel4Beatmap } from './beatmaps/nivel4.js';

// Cada nível aponta pra sua própria pasta de texturas, todas seguindo a
// mesma estrutura/recorte usada no Nível 1.
export const LEVELS = [
    {
        id: 1,
        name: "Nivel 1",
        musicUrl: "assets/audio/nivel1.mp3",
        beatmap: nivel1Beatmap,
        towerHp: 100,
        enemyDamage: 10,
        unlocked: true,
        textures: {
            altarBase: "assets/textures/level1/altar_base.png",
            flame: "assets/textures/level1/flame.png",
            background: "assets/textures/level1/background.png",
        },
        // Cores do feixe de energia
        energyColors: {
            core: [0.80, 0.95, 1.00, 1.0],
            mid: [0.25, 0.65, 1.00, 1.0],
            glow: [0.05, 0.30, 0.85, 1.0],
        },
    },
    {
        id: 2,
        name: "Nivel 2",
        musicUrl: "assets/audio/nivel2.mp3",
        beatmap: nivel2Beatmap,
        towerHp: 100,
        enemyDamage: 10,
        unlocked: true,
        textures: {
            altarBase: "assets/textures/level2/altar_base.png",
            flame: "assets/textures/level2/flame.png",
            background: "assets/textures/level2/background.png",
        },
        energyColors: {
            core: [1.00, 0.95, 0.55, 1.0],
            mid: [1.00, 0.55, 0.15, 1.0],
            glow: [1.00, 0.25, 0.05, 1.0],
        },
    },
    {
        id: 3,
        name: "Nivel 3",
        musicUrl: "assets/audio/nivel3.mp3",
        beatmap: nivel3Beatmap,
        towerHp: 100,
        enemyDamage: 15,
        unlocked: true,
        textures: {
            altarBase: "assets/textures/level3/altar_base.png",
            flame: "assets/textures/level3/flame.png",
            background: "assets/textures/level3/background.png",
        },
        energyColors: {
            core: [1.00, 0.85, 0.95, 1.0],
            mid: [1.00, 0.35, 0.65, 1.0],
            glow: [0.85, 0.05, 0.45, 1.0],
        },
    },
    {
        id: 4,
        name: "Nivel 4",
        musicUrl: "assets/audio/nivel4.mp3",
        beatmap: nivel4Beatmap,
        towerHp: 100,
        enemyDamage: 20,
        unlocked: true,
        textures: {
            altarBase: "assets/textures/level4/altar_base.png",
            flame: "assets/textures/level4/flame.png",
            background: "assets/textures/level4/background.png",
        },
        energyColors: {
            core: [0.85, 1.00, 0.75, 1.0],
            mid: [0.30, 0.90, 0.35, 1.0],
            glow: [0.05, 0.55, 0.15, 1.0],
        },
    },
];

export function getLevel(id) {
    return LEVELS.find(level => level.id === id);
}