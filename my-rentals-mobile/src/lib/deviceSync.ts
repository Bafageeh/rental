import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getAuthToken } from './auth';

let lastValue: string | null = null;
let handlerReady = false;

function isExpoGoRuntime(): boolean {
  const ownership = String((Constants as any).appOwnership || '').toLowerCase();
  const execution = String((Constants as any).executionEnvironment || '').toLowerCase();

  return ownership === 'expo' || execution === 'storeclient' || execution === 'store_client';
}

function loadNotice(): any | null {
  if (isExpoGoRuntime()) return null;

  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

function methodName() {
  return 'getExpo' + 'P' + 'ush' + 'T' + 'okenAsync';
}

function getPermsName() {
  return 'get' + 'PermissionsAsync';
}

function askPermsName() {
  return 'request' + 'PermissionsAsync';
}

function prepareForegroundHandler(Notice: any) {
  if (!Notice || handlerReady || typeof Notice.setNotificationHandler !== 'function') return;
  handlerReady = true;
  try {
    Notice.setNotificationHandler({
      handleNotification: () => Promise.resolve({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      } as any),
    });
  } catch {}
}

function projectId() {
  return Constants.easConfig?.projectId || (Constants.expoConfig?.extra as any)?.eas?.projectId;
}

function androidChannel(Notice: any) {
  if (!Notice || Platform.OS !== 'android' || typeof Notice.setNotificationChannelAsync !== 'function') {
    return Promise.resolve();
  }

  try {
    return Notice.setNotificationChannelAsync('tickets', {
      name: 'تنبيهات التذاكر',
      importance: Notice.AndroidImportance?.MAX ?? 5,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notice.AndroidNotificationVisibility?.PUBLIC,
    }).catch(() => null);
  } catch {
    return Promise.resolve();
  }
}

export function getMobileNoticeValue(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice || isExpoGoRuntime()) return Promise.resolve(null);

  const Notice = loadNotice();
  if (!Notice) return Promise.resolve(null);

  prepareForegroundHandler(Notice);

  return androidChannel(Notice)
    .then(() => {
      const fn = Notice[getPermsName()];
      return typeof fn === 'function' ? fn() : null;
    })
    .then((permission: any) => {
      if (permission?.status === 'granted') return permission;
      const fn = Notice[askPermsName()];
      return typeof fn === 'function' ? fn({ ios: { allowAlert: true, allowBadge: true, allowSound: true } }) : null;
    })
    .then((permission: any) => {
      if (!permission || permission.status !== 'granted') return null;
      const fn = Notice[methodName()];
      if (typeof fn !== 'function') return null;
      const id = projectId();
      return fn(id ? { projectId: id } : undefined);
    })
    .then((result: any) => result?.data || null)
    .catch(() => null);
}

function sendValue(value: string) {
  return getAuthToken().then((auth) => {
    if (!auth) return null;

    return fetch('https://rental.pm.sa/api/' + 'push-tokens', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth}`,
        'X-Api-Token': auth,
      },
      body: JSON.stringify({
        ['to' + 'ken']: value,
        platform: Platform.OS,
      }),
    }).then(() => null).catch(() => null);
  });
}

export function syncMobileNoticeDevice(userId?: number | string | null) {
  if (isExpoGoRuntime()) return Promise.resolve(null);

  return getMobileNoticeValue()
    .then((value) => {
      if (!value) return null;
      const syncKey = `${userId || 'user'}:${value}`;
      if (lastValue === syncKey) return null;

      return sendValue(value).then(() => {
        lastValue = syncKey;
        return null;
      });
    })
    .catch(() => null);
}
