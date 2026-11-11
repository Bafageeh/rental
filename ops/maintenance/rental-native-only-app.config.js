// Source: Bafageeh/rental ops/maintenance.
// Expo Go/Metro must not SSR/bundle public web requests in the persistent dev server.
// The independent production web export still uses the normal web-enabled config.
module.exports = ({config}) => {
  if (process.env.PSM_RENTAL_NATIVE_METRO === '1') {
    return {...config, platforms:['android','ios']};
  }
  return config;
};
