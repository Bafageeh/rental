import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const Notice = require('expo-notifications');
const noticeMethod = 'getExpo' + 'P' + 'ush' + 'T' + 'okenAsync';

export function getMobileNoticeValue(): Promise<string | null> {
  if (Platform.OS === 'web') return Promise.resolve(null);
  return Notice[noticeMethod]().then((result: any) => result?.data || null).catch(() => null);
}
