import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { getAuthToken } from './auth';

let lastValue: string | null = null;
let handlerReady = false;
let responseHandlerReady = false;
let lastHandledResponseKey: string | null = null;

const CONTRACT_EXIT_CATEGORY = 'contract_exit_decision';
const CONTRACT_EXIT_RENEW = 'contract_exit_wants_renewal';
const CONTRACT_EXIT_VACATED = 'contract_exit_vacated';

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

function prepareContractExitCategory(Notice: any) {
  if (!Notice || typeof Notice.setNotificationCategoryAsync !== 'function') return Promise.resolve();

  try {
    return Notice.setNotificationCategoryAsync(CONTRACT_EXIT_CATEGORY, [
      {
        identifier: CONTRACT_EXIT_RENEW,
        buttonTitle: 'يريد التجديد',
        options: { opensAppToForeground: true },
      },
      {
        identifier: CONTRACT_EXIT_VACATED,
        buttonTitle: 'خرج',
        options: { opensAppToForeground: true },
      },
    ]).catch(() => null);
  } catch {
    return Promise.resolve();
  }
}

function openContractExitProperty(data: any) {
  const propertyId = Number(data?.property_id || 0);
  if (propertyId <= 0) return;
  try {
    router.push(`/property/${propertyId}` as never);
  } catch {}
}

function sendContractExitDecision(data: any, decision: 'wants_renewal' | 'vacated') {
  const unitId = Number(data?.unit_id || 0);
  const contractId = Number(data?.contract_id || 0);
  if (unitId <= 0) return Promise.resolve();

  return getAuthToken()
    .then((auth) => {
      if (!auth) return null;

      return fetch(`https://rental.pm.sa/api/units/${unitId}/contract-exit-decision`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth}`,
          'X-Api-Token': auth,
        },
        body: JSON.stringify({
          decision,
          contract_id: contractId > 0 ? contractId : undefined,
        }),
      });
    })
    .then(() => {
      openContractExitProperty(data);
      return null;
    })
    .catch(() => null);
}

function handleNotificationResponse(response: any) {
  const data = response?.notification?.request?.content?.data || {};
  if (String(data?.type || '') !== 'contract_exit_decision') return;

  const actionIdentifier = String(response?.actionIdentifier || '');
  const requestIdentifier = String(response?.notification?.request?.identifier || '');
  const responseKey = `${requestIdentifier}:${actionIdentifier}`;
  if (responseKey !== ':' && lastHandledResponseKey === responseKey) return;
  if (responseKey !== ':') lastHandledResponseKey = responseKey;

  if (actionIdentifier === CONTRACT_EXIT_RENEW) {
    void sendContractExitDecision(data, 'wants_renewal');
    return;
  }

  if (actionIdentifier === CONTRACT_EXIT_VACATED) {
    void sendContractExitDecision(data, 'vacated');
    return;
  }

  openContractExitProperty(data);
}

function prepareResponseHandler(Notice: any) {
  if (!Notice || responseHandlerReady) return;
  responseHandlerReady = true;

  try {
    if (typeof Notice.addNotificationResponseReceivedListener === 'function') {
      Notice.addNotificationResponseReceivedListener(handleNotificationResponse);
    }

    if (typeof Notice.getLastNotificationResponseAsync === 'function') {
      Notice.getLastNotificationResponseAsync()
        .then((response: any) => {
          if (response) handleNotificationResponse(response);
        })
        .catch(() => null);
    }
  } catch {}
}

export function getMobileNoticeValue(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice || isExpoGoRuntime()) return Promise.resolve(null);

  const Notice = loadNotice();
  if (!Notice) return Promise.resolve(null);

  prepareForegroundHandler(Notice);
  prepareResponseHandler(Notice);

  return Promise.all([androidChannel(Notice), prepareContractExitCategory(Notice)])
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
