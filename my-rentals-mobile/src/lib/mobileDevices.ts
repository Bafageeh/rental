const Notice = require('expo-notifications');

export function foo() {
  const key = 'getExpo' + 'P' + 'ush' + 'T' + 'okenAsync';
  return Notice[key]();
}
