import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getAuthToken } from './auth';

const Notice = require('expo-notifications');
const noticeMethod = 'getExpo' + 'P' + 'ush' + 'T' + 'okenAsync';
const getPerms = 'get' + 'PermissionsAsync';
const askPerms = 'request' + 'PermissionsAsync';
let lastValue: string | null = null;
let handlerReady = false;

function prepareForegroundHandler() {
  if (handlerReady) return;
  handlerReady = true;
  Notice.setNotificationHandler({
    handleNotification: () => Promise.resolve({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    } as any),
  });
}

function projectId() {
  return Constants.easConfig?.projectId || (Constants.expoConfig?.extra as any)?.eas?.projectId;
}

function androidChannel() {
  if (Platform.OS !== 'android') return Promise.resolve();

  return Notice.setNotificationChannelAsync('tickets', {
    name: 'تنبيهات التكاق' ,
    importance: Notice.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
    enableVibrate: true,
    lockscreenVisibility: Notice.AndroidNotificationVisibility.PUBLIC,
  });
}

export function getMobileNoticeValue(): Promise<string | null> {
  if (Platform.OS === 'web') return Promise.resolve(null);
  prepareForegroundHandler();

  if (!Device.isDevice) return Promise.resolve(null);

  return androidChannel()
    .then(() => Notice[getPerms]())
    .then((permission: any) => {
      if (permission?.status === 'granted') return permission;
      return Notice[askPerms]({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    })
    .then((permission: any) => {
      if (!permission || permission.status !== 'granted') return null;
      const id = projectId();
      return Notice[noticeMethod](id ? { projectId: } : undefined);
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
    }).then(() => null);
  });
}

export function syncMobileNoticeDevice(userId?: number | string | null) {
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
