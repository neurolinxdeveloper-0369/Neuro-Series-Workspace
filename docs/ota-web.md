# Web OTA firmware administration

URL: `https://neurolinx.in/neuro-series/OTA` (case-sensitive).
The normal Android/iOS interface has no OTA navigation or update controls.

## Deployment

Set `OTA_ACCESS_CODE_HASH` on the API service through the Portainer stack's environment variables.
It must contain a random 16-byte salt (32 hex characters), a colon, then a 64-byte scrypt hash (128 hex characters).
Generate it from an operator-provided access code with Node's `crypto.scryptSync(code, salt, 64)`.
Never put the plain code, the hash configuration, or login session tokens in Git or frontend environment variables.
The API service mapping is included in `docker-compose.yml`; apply the updated stack configuration and re-pull the image.
With this configuration missing, the page is visible but unlock returns 503 and all device/upload/job endpoints stay locked.

The code grants access to every user's registered devices. The portal requires no app account, email or phone number.
Sessions have their own JWT audience and expire in 30 minutes. App account tokens cannot authorize OTA and OTA tokens cannot authorize normal app APIs.
The API permits at most six code attempts per minute per API instance. It never logs the code.

`OTA_PUBLIC_BASE_URL` defaults to `https://neurolinx.in/neuro-series/api/ota`.
This address must be reachable by hardware, with TLS supported by the deployed firmware. Do not point it at a container-only hostname.
Firmware and job state live in PostgreSQL; no extra container volume is required. Include them in database capacity/backup planning.

## Operator flow

1. Unlock with the access code.
2. Select the exact hardware model, enter a version, and choose/drop one `.bin` image.
3. Upload. This stores the image and SHA-256 digest; it does not issue a command.
4. Search the all-users device table and select matching online devices (maximum 20).
5. Verify binary/flash compatibility, confirm, and submit.
6. Watch progress and the device's report. After success, wait for a fresh heartbeat to show reconnection.

The ESP image header, filename, size (32 bytes–4 MiB), model metadata and digest are checked.
These checks do not authenticate the firmware's publisher or prove that its flash layout is compatible with a device.
Upload only a tested application firmware binary, not a filesystem/flash dump, bootloader or merged image.

## Wire protocol

Before dispatch, the API subscribes to `devices/{deviceId}/ota/stat` at QoS 0 and waits for SUBACK.
It publishes exactly `{"url":"<per-job download URL>"}` to `devices/{deviceId}/ota` at QoS 1, retain=false.
The firmware URL is a random 256-bit per-job capability, expires in 30 minutes and returns the original binary with a Content-Length header.
Anonymous downloads without the correct capability fail. Administrative endpoints always require an OTA session.

Accepted hardware reports:

```json
{"status":"downloading","progress":0}
{"status":"downloading","progress":45}
{"status":"success","progress":100}
{"status":"failed","progress":-1}
```

The server ignores retained status messages, malformed payloads and progress regressions.
Only one active job per device is allowed by a database unique index.
Because the hardware report has no job identifier, reports apply only to the newest active/unconfirmed job; do not restart immediately while an earlier flash may still be running.
No report for three minutes becomes **unconfirmed**, not success. No automatic retry occurs.
Publish uncertainty is also shown as unconfirmed because MQTT delivery may already have occurred.
Late device reports can resolve the newest unconfirmed job. Terminal success/failure is not overwritten by stale reports.
Failure details are generic because the supplied firmware protocol does not include a reason field.

An independently authenticated WebSocket (`OTA_AUTH`) sends `OTA_UPDATE` events only to OTA sessions.
The page also polls every 2.5 seconds to recover lost events and refresh connectivity/history across reloads.
Normal household WebSocket sessions never receive OTA events.

## Verification boundaries

Automated tests use a mock broker; database integration tests run in CI with PostgreSQL.
They do not flash real hardware. A real update must be tested with a known-compatible binary and selected test device.
Do not use a production device as a test target without the operator's selection and confirmation.
