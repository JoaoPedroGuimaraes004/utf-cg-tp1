// levels.js
// Configuração central de cada nível: música, BPM e dificuldade.
// Em vez de valores fixos espalhados pelo main.js, cada nível vira
// um objeto aqui. Isso facilita adicionar/ajustar níveis sem mexer
// na lógica do jogo.
//
// TODO (pessoa dos níveis/UI):
//   - Trocar musicUrl pelos arquivos de música reais de cada nível
//     (ex: "assets/musicas/nivel1.mp3").
//   - Ajustar bpm para bater com a música escolhida.
//   - Marcar unlocked: true conforme os níveis 2 a 4 forem implementados.

export const LEVELS = [
    {
        id: 1,
        name: "Nivel 1",
        musicUrl: null, // TODO: caminho da música do nível 1
        bpm: 120,
        towerHp: 100,
        enemyDamage: 10,
        unlocked: true,
    },
    {
        id: 2,
        name: "Nivel 2",
        musicUrl: null, // TODO: caminho da música do nível 2
        bpm: 140,
        towerHp: 100,
        enemyDamage: 10,
        unlocked: false,
    },
    {
        id: 3,
        name: "Nivel 3",
        musicUrl: null, // TODO: caminho da música do nível 3
        bpm: 160,
        towerHp: 100,
        enemyDamage: 15,
        unlocked: false,
    },
    {
        id: 4,
        name: "Nivel 4",
        musicUrl: null, // TODO: caminho da música do nível 4
        bpm: 175,
        towerHp: 100,
        enemyDamage: 20,
        unlocked: false,
    },
];

export function getLevel(id) {
    return LEVELS.find(level => level.id === id);
}