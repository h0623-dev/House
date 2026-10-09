import { Capacitor } from '@capacitor/core';
import { isWebUpdateSupported } from './web-update';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let installPrompt: InstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', event => {
  if (Capacitor.isNativePlatform()) return;
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
});
window.addEventListener('appinstalled', () => { installPrompt = null; });

export function isAppleMobileDevice(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
export function isHomeScreenGame(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
export function showInstallHelp(): boolean {
  return !isHomeScreenGame() && isWebUpdateSupported();
}
export function hasInstallPrompt(): boolean { return installPrompt !== null; }
export async function installHomeScreenGame(): Promise<boolean> {
  if (!installPrompt) return false;
  const prompt = installPrompt;
  installPrompt = null;
  await prompt.prompt();
  return (await prompt.userChoice).outcome === 'accepted';
}

export function homeScreenInstructions(): string {
  return isAppleMobileDevice()
    ? '<ol class="pwa-install-steps"><li>이 게임 주소를 <strong>Safari</strong>에서 열어요.</li><li>Safari의 <strong>공유</strong> 버튼을 눌러요. 보이지 않으면 메뉴를 먼저 열어요.</li><li><strong>홈 화면에 추가</strong>를 선택하고 추가를 눌러요.</li><li>홈 화면의 <strong>로드헤이븐</strong> 아이콘으로 시작해요.</li></ol>'
    : '<ol class="pwa-install-steps"><li>브라우저 메뉴를 열어요.</li><li><strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택해요.</li><li>로드헤이븐 아이콘으로 시작해요.</li></ol>';
}
