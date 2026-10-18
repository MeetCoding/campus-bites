import * as Haptics from 'expo-haptics';

// Fire-and-forget: haptics are a nicety, so a device without a haptics engine (or the web
// Vibration API refusing) must never surface an error.

/** Pill, tab, day and segment changes. */
export function selectionTap(): void {
  Haptics.selectionAsync().catch(() => {});
}

/** Buttons, cards, toggles, upvotes and nudges. */
export function impactTap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void {
  Haptics.impactAsync(style).catch(() => {});
}

export function successTap(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export { ImpactFeedbackStyle } from 'expo-haptics';
