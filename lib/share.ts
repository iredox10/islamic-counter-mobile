import { Share, Alert, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { format } from 'date-fns';
import { gregorianToHijri } from './hijri';
import type { RefObject, Component } from 'react';
import type { View } from 'react-native';

export interface ShareCardData {
  title: string;
  count: number;
  targetCount: number;
  completedAt: Date;
  streak?: number;
  totalLifetime?: number;
}

export function generateShareText(data: ShareCardData): string {
  const hijri = gregorianToHijri(data.completedAt);
  const completionPercent = Math.round((data.count / data.targetCount) * 100);

  return [
    '✨ Alhamdulillah! Dhikr Progress Completed ✨',
    `📌 Goal: ${data.title}`,
    `🔢 Count: ${data.count.toLocaleString()} / ${data.targetCount.toLocaleString()} (${completionPercent}%)`,
    data.streak ? `🔥 Current Streak: ${data.streak} days` : '',
    data.totalLifetime ? `🏆 Total Lifetime Dhikr: ${data.totalLifetime.toLocaleString()}` : '',
    `📅 ${format(data.completedAt, 'MMMM d, yyyy')} • ${hijri.formatted}`,
    '\nShared via Islamic Counter Mobile'
  ].filter(Boolean).join('\n');
}

export function generateShareCardSVG(data: ShareCardData): string {
  const hijriDate = gregorianToHijri(data.completedAt);
  const completionPercent = Math.round((data.count / data.targetCount) * 100);

  return `
<svg width="400" height="500" viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#020617"/>
    </linearGradient>
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#fbbf24"/>
      <stop offset="100%" style="stop-color:#d97706"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="400" height="500" fill="url(#bgGradient)"/>
  <rect x="10" y="10" width="380" height="480" rx="20" fill="none" stroke="rgba(212, 175, 55, 0.3)" stroke-width="2"/>

  <!-- Header -->
  <text x="200" y="60" text-anchor="middle" fill="#d4af37" font-family="serif" font-size="16">الْحَمْدُ لِلَّهِ</text>
  <text x="200" y="90" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="12" letter-spacing="2">ALHAMDULILLAH</text>

  <!-- Icon & Title -->
  <circle cx="200" cy="180" r="55" fill="rgba(212, 175, 55, 0.1)" stroke="url(#goldGradient)" stroke-width="2.5"/>
  <text x="200" y="195" text-anchor="middle" fill="url(#goldGradient)" font-size="44">🏆</text>

  <text x="200" y="275" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="20" font-weight="bold">${escapeXml(data.title)}</text>
  <text x="200" y="335" text-anchor="middle" fill="url(#goldGradient)" font-family="serif" font-size="46" font-weight="bold">${data.count.toLocaleString()}</text>
  <text x="200" y="360" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="13">Target: ${data.targetCount.toLocaleString()} (${completionPercent}%)</text>

  <!-- Footer -->
  <line x1="50" y1="450" x2="350" y2="450" stroke="rgba(148, 163, 184, 0.2)" stroke-width="1"/>
  <text x="200" y="475" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="10">${format(data.completedAt, 'MMMM d, yyyy')} • ${hijriDate.formatted}</text>
</svg>
  `.trim();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function shareProgress(data: ShareCardData): Promise<void> {
  const message = generateShareText(data);
  try {
    await Share.share({
      message,
      title: 'My Dhikr Milestone',
    });
  } catch (error: any) {
    Alert.alert('Share Failed', error.message || 'Could not open share menu');
  }
}

export async function shareProgressImage(
  data: ShareCardData,
  cardRef: RefObject<Component<object, {}, any> | View | null>
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  let uri: string | null = null;
  try {
    uri = await captureRef(cardRef, {
      format: 'png',
      quality: 1,
    });
  } catch {
    return false;
  }

  try {
    const exporter = await import('expo-sharing');
    const isAvailable = await exporter.isAvailableAsync();
    if (isAvailable) {
      await exporter.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'My Dhikr Milestone',
        UTI: 'public.png',
      });
      return true;
    }
  } catch {
    /* fall through to RN share */
  }

  try {
    await Share.share({
      message: generateShareText(data),
      url: uri,
      title: 'My Dhikr Milestone',
    });
    return true;
  } catch {
    return false;
  }
}
