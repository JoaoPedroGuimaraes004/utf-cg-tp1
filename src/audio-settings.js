// Controle global de volume do site. Qualquer <audio> do jogo (música do
// menu, música de nível, efeitos sonoros futuros, etc.) deve ser
// registrado aqui com registerAudio() para ficar sincronizado com o
// volume escolhido pelo jogador no botão da tela inicial.
//
// O valor escolhido é salvo no localStorage, então o volume é lembrado
// entre uma visita e outra.

const STORAGE_KEY = "utf-cg-tp1:volume";

function loadStoredVolume() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const value = stored !== null ? parseFloat(stored) : 1;
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

let currentVolume = loadStoredVolume();
const registeredAudios = new Set();
const listeners = [];

// Retorna o volume atual (0 a 1).
export function getVolume() {
    return currentVolume;
}

// Define um novo volume (0 a 1), aplica em todo áudio registrado,
// salva no localStorage e avisa quem estiver ouvindo (ex: o ícone do
// botão de volume).
export function setVolume(value) {
    currentVolume = Math.min(1, Math.max(0, value));
    localStorage.setItem(STORAGE_KEY, String(currentVolume));
    registeredAudios.forEach((audio) => {
        audio.volume = currentVolume;
    });
    listeners.forEach((callback) => callback(currentVolume));
}

// Registra um elemento de áudio (instância de Audio ou <audio>) para
// que seu volume seja mantido em sincronia com o volume global.
export function registerAudio(audio) {
    if (!audio) return audio;
    audio.volume = currentVolume;
    registeredAudios.add(audio);
    return audio;
}

// Remove um áudio do controle global (ex: antes de trocar de faixa).
export function unregisterAudio(audio) {
    registeredAudios.delete(audio);
}

// Registra uma função chamada toda vez que o volume global muda.
export function onVolumeChange(callback) {
    listeners.push(callback);
}
