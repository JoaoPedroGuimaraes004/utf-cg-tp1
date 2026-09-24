// Configuração central de cada nível: música, BPM e dificuldade.

import { nivel1Beatmap } from './beatmaps/nivel1.js';

export const LEVELS = [
    {
        id: 1,
        name: "Nivel 1",
        musicUrl: "assets/audio/nivel1.mp3",
        beatmap: nivel1Beatmap,
        towerHp: 100,
        enemyDamage: 10,
        unlocked: true,
    },
    {
        id: 2,
        name: "Nivel 2",
        musicUrl: null,
        beatmap: [],
        towerHp: 100,
        enemyDamage: 10,
        unlocked: false,
    },
    {
        id: 3,
        name: "Nivel 3",
        musicUrl: null,
        beatmap: [],
        towerHp: 100,
        enemyDamage: 15,
        unlocked: false,
    },
    {
        id: 4,
        name: "Nivel 4",
        musicUrl: null,
        beatmap: [],
        towerHp: 100,
        enemyDamage: 20,
        unlocked: false,
    },
];

export function getLevel(id) {
    return LEVELS.find(level => level.id === id);
}