# homebridge-broadlink-gree-ac

Control a **GREE air conditioner / heat pump via a Broadlink RM4 Pro** (IR blaster) from **Apple HomeKit** through Homebridge — including the **RM4 Pro's built-in room temperature & humidity sensor**.

## Features

- **HeaterCooler** accessory in HomeKit (heat / cool modes + fan speed)
- **Room temperature reported to HomeKit** — read directly from the Broadlink RM4 Pro's built-in sensor and refreshed every 60 seconds
- **Anti-frost switch** — forces the AC to a low HEAT setpoint (8 °C by default) to keep a room above freezing
- **MAC address auto-discovered** from the device IP — no manual entry needed
- Works out-of-the-box with the bundled GREE SmartIR code file (GWH12-KF-K3DNA5G-I / 1180.json); custom SmartIR JSON files are also supported
- Also compatible with the Broadlink RM4 Mini (which has no temperature sensor — IR control only)

## Installation

Search **broadlink gree** in the Homebridge UI plugin manager, or:

```bash
npm install homebridge-broadlink-gree-ac
```

## Configuration

```json
{
  "platform": "BroadlinkGreeAC",
  "name": "Broadlink GREE AC",
  "devices": [
    {
      "name": "Salon sous-sol AC",
      "host": "192.168.x.x",
      "antiFrostSwitch": true,
      "antiFrostTemperature": 8
    }
  ]
}
```

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| name | yes | — | Accessory name in HomeKit |
| host | yes | — | Broadlink RM4 Pro IP address |
| mac | no | auto | MAC address — auto-discovered from IP if omitted |
| irCodesFile | no | bundled 1180.json | Full path to a custom SmartIR JSON file on the server |
| minTemperature | no | 8 | Minimum temperature (°C) |
| maxTemperature | no | 30 | Maximum temperature (°C) |
| antiFrostSwitch | no | true | Show the anti-frost switch in HomeKit |
| antiFrostTemperature | no | 8 | Temperature when anti-frost is active |
| antiFrostNameSuffix | no | anti-frost | Suffix for the switch name |
| antiFrostCode | no | — | Optional raw Broadlink IR code (base64) sent for anti-frost instead of building it from the SmartIR file |

## Room Temperature & Humidity

The Broadlink RM4 Pro has a built-in temperature and humidity sensor. This plugin authenticates with the device and reads that sensor, reporting the room temperature to HomeKit's **Current Temperature** characteristic and logging both temperature and humidity. The value refreshes automatically every 60 seconds.

> Note: the RM4 **Mini** does not have this sensor — on that model the plugin provides IR control only.

## Anti-Frost Switch

| State | Device was OFF | Device was ON |
|-------|----------------|---------------|
| Switch ON | Powers on HEAT at antiFrostTemperature | Sets HEAT at antiFrostTemperature |
| Switch OFF | Turns the AC off | Restores the previous setpoint |

## Changelog

### [1.0.30] - 2026-06-06
- Documentation: updated README to reflect the RM4 Pro and the now-working temperature/humidity sensor; cleaned up the changelog

### [1.0.29] - 2026-06-06
- **RM4 Pro temperature & humidity sensor now working!** Room temperature is reported to HomeKit and refreshed every 60 seconds.
- Reverse-engineered the RM4 Pro authentication protocol: correct 8-byte packet signature, the correct default AES key for current RM4-family firmware, and length-prefixed payload framing for sensor and IR commands.
- After a successful authentication handshake, all commands (IR and sensor) use the negotiated device session key.
- Temperature polling now runs continuously instead of being disabled after a few transient failures.

### [1.0.9 – 1.0.28] - 2026-06-06
- Development iterations toward RM4 Pro temperature/humidity support, persistent-socket authentication, and IR reliability.

### [1.0.8] - 2026-06-05
- Updated README changelog (no code changes)

### [1.0.7] - 2026-06-05
- Fixed critical crash: the bundled 1180.json is used by default when irCodesFile is not configured
- irCodesFile is now truly optional — the plugin works out-of-the-box

### [1.0.6] - 2026-06-05
- config.schema: MAC Address and SmartIR JSON File Path are now truly optional in the UI
- Minimum temperature default changed to 8 °C in the UI
- Device Type field hidden from the UI (auto-detected)

### [1.0.5] - 2026-06-05
- Version bump (schema fix attempt)

### [1.0.4] - 2026-06-05
- MAC address field is now truly optional in the UI (auto-discovered from IP)
- SmartIR JSON file path is now optional (bundled 1180.json used by default)
- Minimum temperature default changed from 16 °C to 8 °C in the UI

### [1.0.3] - 2026-06-05
- Minimum temperature defaults to the anti-frost temperature (8 °C) so the setpoint is always reachable
- HomeKit characteristics updated after every IR send
- Explicit state save before anti-frost activation and restore on deactivation
- Bundled GREE 1180.json from SmartIR — no external file needed

### [1.0.2] - 2026-06-05
- MAC address auto-discovered from IP (optional config)
- codes/1180.json bundled in package

### [1.0.1] - 2026-06-05
- MAC address optional — auto-discovered from IP using the Broadlink discovery protocol
- Added README with full documentation

### [1.0.0] - 2026-06-05
- Initial release

## Acknowledgements

- **lprhodes / kiwi-cam** (homebridge-broadlink-rm) — reference for Broadlink + Homebridge integration
- **mjg59 / python-broadlink** — protocol documentation used to implement the Broadlink UDP communication and RM4 Pro authentication
- **SmartIR** — IR code file format used by this plugin
