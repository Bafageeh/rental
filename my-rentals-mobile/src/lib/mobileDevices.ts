const Notice = require('expo-notifications');

export function foo() {
  Notice.setNotificationHandler({ handleNotification: () => Promise.resolve({ shouldPlaySound: true }) });
  return 1;
}
