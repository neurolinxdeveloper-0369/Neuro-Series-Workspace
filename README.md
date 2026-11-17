# Neuro Series

Neuro Series uses a shared React client for web, Capacitor Android and Capacitor iOS, and an Express API backed by PostgreSQL and EMQX.

## Local checks

- Run `npm ci` and `npm --prefix server ci` to install dependencies.
- Run `npm run build` and `npm --prefix server test` to verify the frontend and backend.
- Set `NEURO_TEST_DATABASE_URL` to a disposable PostgreSQL database to run the home-sharing integration test locally.
- Use `server/.env.example` to configure the API before starting it. Run `npm --prefix server run dev` and `npm run dev` for local development.
- For a native build, set `VITE_BASE_PATH=./`, build the web client, and sync the desired Capacitor target. Build Android using Gradle and iOS using Xcode.

## Deployment and pairing

Set a randomly generated `JWT_SECRET` of at least 32 bytes. Deploy the frontend and backend together because telemetry connections now authenticate. Existing sessions require sign-in again.

Set SMTP and OpenWA credentials for the sign-in methods you offer, and configure the matching Google client IDs if you offer Google sign-in. Supply broker service credentials in `MQTT_USERNAME` and `MQTT_PASSWORD`. Set separate device credentials in `MQTT_DEVICE_USERNAME` and `MQTT_DEVICE_PASSWORD` and configure their broker permissions for device traffic only. The application retrieves device credentials during pairing. Existing installations using credentials previously present in the repository or artifacts should rotate them, along with any deployment webhook that used the old fallback.

Commands publish to one MQTT topic. Use `MQTT_USE_LEGACY_COMMAND_TOPICS=true` only when the deployed firmware subscribes to the legacy command topics. Confirm this setting and the firmware's pairing status response on hardware before rollout.

## Device readings, notifications, and app lock

The web and installed apps display registered relay endpoints using the existing MQTT on/off command. A requested switch state is confirmed when firmware publishes it in `switches`. Sensor and phase endpoints may include top-level `readings` in telemetry, keyed by registered endpoint index. Each entry has a finite numeric or boolean `value` and an optional `unit`. For example:

```json
{"switches":{"2":true},"readings":{"1":{"value":64,"unit":"%"}}}
```

Specialized functions such as IR temperature, lighting color, curtain position, and pump automation require firmware-specific commands. Assign MQTT identities and topic access per device in the broker.

Connection transitions and protection alerts appear in the account?s in-app notification history. Optional system alerts work while the app can refresh its feed. Delivery to a closed or suspended app requires a push provider and background registration.

Biometric app lock uses native device authentication on Android 10 or later and supported iOS devices with enrolled biometrics. The browser uses normal account sign-in. Use a physical device to verify enrollment, background and resume, notification permissions, and hardware pairing before release.
