# Changelog

## [1.0.32] - 2026-06-26
- Fixed: HomeKit Current Temperature no longer shows the target setpoint after a scene or temperature change. It now always reflects the RM4 Pro room sensor reading.
- Temperature now refreshed to HomeKit every 30s (was 60s); log line still limited to once every 30 minutes.

## [1.0.31] - 2026-06-26
- Room temperature is still read every 60s (HomeKit stays current) but now logged only once every 30 minutes instead of every poll, to avoid flooding the Homebridge log.
- Added a "Enable Room Temperature Sensor" checkbox in the plugin config UI (temperatureSensor, default on). Uncheck it for an RM4 Mini that has no sensor; the flag is now actually honored to enable/disable polling.

## [1.0.30] - 2026-06-06
- Documentation: updated README to reflect the RM4 Pro and the now-working temperature/humidity sensor; cleaned up the changelog

## [1.0.29] - 2026-06-06
- **RM4 Pro temperature & humidity sensor now working!** Room temperature is reported to HomeKit and refreshed every 60 seconds.
- Reverse-engineered the RM4 Pro authentication protocol: correct 8-byte packet signature, the correct default AES key for current RM4-family firmware, and length-prefixed payload framing for sensor and IR commands.
- After a successful authentication handshake, all commands (IR and sensor) use the negotiated device session key.
- Temperature polling now runs continuously instead of being disabled after a few transient failures.

## [1.0.9 - 1.0.28] - 2026-06-06
- Development iterations toward RM4 Pro temperature/humidity support, persistent-socket authentication, and IR reliability.

## [1.0.8] - 2026-06-05
- Updated README changelog (no code changes)

## [1.0.7] - 2026-06-05
- Fixed critical crash: the bundled 1180.json is used by default when irCodesFile is not configured
- irCodesFile is now truly optional - the plugin works out-of-the-box

## [1.0.6] - 2026-06-05
- config.schema: MAC Address and SmartIR JSON File Path are now truly optional in the UI
- Minimum temperature default changed to 8 C in the UI
- Device Type field hidden from the UI (auto-detected)

## [1.0.5] - 2026-06-05
- Version bump (schema fix attempt)

## [1.0.4] - 2026-06-05
- MAC address field is now truly optional in the UI (auto-discovered from IP)
- SmartIR JSON file path is now optional (bundled 1180.json used by default)
- Minimum temperature default changed from 16 C to 8 C in the UI

## [1.0.3] - 2026-06-05
- Minimum temperature defaults to the anti-frost temperature (8 C) so the setpoint is always reachable
- HomeKit characteristics updated after every IR send
- Explicit state save before anti-frost activation and restore on deactivation
- Bundled GREE 1180.json from SmartIR - no external file needed

## [1.0.2] - 2026-06-05
- MAC address auto-discovered from IP (optional config)
- codes/1180.json bundled in package

## [1.0.1] - 2026-06-05
- MAC address optional - auto-discovered from IP using the Broadlink discovery protocol
- Added README with full documentation

## [1.0.0] - 2026-06-05
- Initial release
