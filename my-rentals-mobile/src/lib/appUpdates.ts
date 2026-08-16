import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

const FOREGROUND_CHECK_INTERVAL_MS = 5 * 60 * 1000;
let updateCheckInProgress = false;

async function checkDownloadAndApplyUpdate() {
  if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled || updateCheckInProgress) return;
  updateCheckInProgress = true;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;
    const fetched = await Updates.fetchUpdateAsync();
    if (fetched.isNew) await Updates.reloadAsync();
  } catch (error) {
    console.warn('[app-updates] Automatic update check failed:', error);
  } finally {
    updateCheckInProgress = false;
  }
}

export function useAutomaticAppUpdates() {
  const lastCheckAt = useRef(0);
  useEffect(() => {
    const checkNow = () => {
      const now = Date.now();
      if (now - lastCheckAt.current < FOREGROUND_CHECK_INTERVAL_MS) return;
      lastCheckAt.current = now;
      void checkDownloadAndApplyUpdate();
    };
    checkNow();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') checkNow();
    });
    return () => subscription.remove();
  }, []);
}
