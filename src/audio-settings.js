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

// Define o volume global (0 a 1) e atualiza todos os elementos de áudio
export function setVolume(value) {
    currentVolume = Math.min(1, Math.max(0, value));
    localStorage.setItem(STORAGE_KEY, String(currentVolume));
    registeredAudios.forEach((audio) => {
        audio.volume = currentVolume;
    });
    listeners.forEach((callback) => callback(currentVolume));
}

// Registra um elemento de áudio (HTMLAudioElement) para que ele seja
// controlado pelo volume global do site. Retorna o mesmo elemento de áudio
// para facilitar o encadeamento de chamadas.
export function registerAudio(audio) {
    if (!audio) return audio;
    audio.volume = currentVolume;
    registeredAudios.add(audio);
    return audio;
}

// Remove um áudio do controle global.
export function unregisterAudio(audio) {
    registeredAudios.delete(audio);
}

// Registra uma função chamada toda vez que o volume global muda.
export function onVolumeChange(callback) {
    listeners.push(callback);
}
