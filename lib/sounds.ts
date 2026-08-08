import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import safeStorage from './storage';

export type NotificationSound = 'default' | 'gentle' | 'bell' | 'chime' | 'custom' | 'none';

const SOUND_STORAGE_KEY = 'tasbih-notification-sound';
const CUSTOM_SOUND_KEY = 'tasbih-custom-sound';

const SOUND_ASSETS: Record<string, number> = {
  default: require('../assets/sounds/default.wav'),
  gentle: require('../assets/sounds/gentle.wav'),
  bell: require('../assets/sounds/bell.wav'),
  chime: require('../assets/sounds/chime.wav'),
  tap: require('../assets/sounds/tap.wav'),
};

let players: Record<string, AudioPlayer> = {};
let audioModeSet = false;

async function ensureAudioMode() {
  if (audioModeSet || Platform.OS === 'web') return;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
    audioModeSet = true;
  } catch {}
}

function getPlayer(id: string): AudioPlayer | null {
  if (Platform.OS === 'web') return null;
  const asset = SOUND_ASSETS[id];
  if (!asset) return null;
  if (!players[id]) {
    players[id] = createAudioPlayer(asset);
  }
  return players[id];
}

function playPlayer(id: string) {
  const player = getPlayer(id);
  if (!player) return;
  try {
    player.seekTo(0);
    player.play();
  } catch (e) {}
}

async function playWebCompletion(sound: NotificationSound) {
  if (sound === 'custom') {
    const customUri = await getCustomSoundUri();
    if (customUri && typeof window !== 'undefined') {
      try {
        const audio = new Audio(customUri);
        audio.play().catch(() => {});
        return;
      } catch (e) {}
    }
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const frequencies =
      sound === 'bell'
        ? [523.25, 659.25, 783.99]
        : sound === 'chime'
        ? [659.25, 783.99, 880, 1046.5]
        : sound === 'gentle'
        ? [523.25]
        : [440, 880];

    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.1);

      gain.gain.setValueAtTime(0.2, ctx.currentTime + index * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.1 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + index * 0.1);
      osc.stop(ctx.currentTime + index * 0.1 + 0.35);
    });
  } catch (e) {}
}

let audioCtx: any = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export async function getSelectedSound(): Promise<NotificationSound> {
  try {
    const stored = await safeStorage.getItem(SOUND_STORAGE_KEY);
    if (stored) return stored as NotificationSound;
  } catch {}
  return 'default';
}

export async function setSelectedSound(sound: NotificationSound): Promise<void> {
  await safeStorage.setItem(SOUND_STORAGE_KEY, sound);
}

export async function saveCustomSoundUri(uri: string): Promise<void> {
  await safeStorage.setItem(CUSTOM_SOUND_KEY, uri);
}

export async function getCustomSoundUri(): Promise<string | null> {
  return safeStorage.getItem(CUSTOM_SOUND_KEY);
}

export function playTapSound() {
  if (Platform.OS === 'web') {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    } catch (e) {}
    return;
  }
  playPlayer('tap');
}

export async function playCompletionSound(sound: NotificationSound = 'bell') {
  if (sound === 'none') return;

  await ensureAudioMode();

  if (Platform.OS === 'web') {
    await playWebCompletion(sound);
    return;
  }

  if (sound === 'custom') {
    const customUri = await getCustomSoundUri();
    if (customUri && typeof window !== 'undefined') {
      try {
        const audio = new Audio(customUri);
        audio.play().catch(() => {});
        return;
      } catch (e) {}
    }
  }

  if (SOUND_ASSETS[sound]) {
    playPlayer(sound);
  }
}

export const SOUND_OPTIONS: { id: NotificationSound; name: string; description: string }[] = [
  { id: 'default', name: 'Default Tone', description: 'Dual frequency tone' },
  { id: 'gentle', name: 'Gentle', description: 'Soft single tone' },
  { id: 'bell', name: 'Bell Chime', description: 'Major triad chime' },
  { id: 'chime', name: 'Melodic Chime', description: 'Ascending notes' },
  { id: 'custom', name: 'Custom Audio', description: 'Custom sound URI' },
  { id: 'none', name: 'Silent', description: 'No sound playback' },
];
