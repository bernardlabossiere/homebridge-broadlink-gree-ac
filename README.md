# homebridge-broadlink-gree-ac

Control a **GREE AC via Broadlink RM4 Mini** (IR blaster) from **Apple HomeKit** through Homebridge.

- HeaterCooler (heat / cool / auto + fan speed)
- Anti-frost switch (forces HEAT 8C)
- MAC address auto-discovered from IP — no manual entry needed
- Compatible with SmartIR climate JSON code files (e.g. 1180.json)

## Installation

Search **broadlink gree** in Homebridge UI plugin manager, or:

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
      "irCodesFile": "/homebridge/1180.json",
      "antiFrostSwitch": true,
      "antiFrostTemperature": 8,
      "antiFrostNameSuffix": "anti-frost"
    }
  ]
}
```

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| name | yes | — | Accessory name in HomeKit |
| host | yes | — | Broadlink RM4 Mini IP address |
| irCodesFile | yes | — | Full path to SmartIR JSON file on the server |
| mac | no | auto | MAC address — auto-discovered from IP if omitted |
| minTemperature | no | 16 | Minimum temperature C |
| maxTemperature | no | 30 | Maximum temperature C |
| antiFrostSwitch | no | true | Show anti-frost switch in HomeKit |
| antiFrostTemperature | no | 8 | Temperature when anti-frost is active |
| antiFrostNameSuffix | no | anti-frost | Suffix for the switch name |

## Anti-Frost Switch

| State | Device was OFF | Device was ON |
|-------|----------------|---------------|
| Switch ON | Powers on HEAT antiFrostTemperature | Sets HEAT antiFrostTemperature |
| Switch OFF | Turns off | Restores previous setpoint |

## Changelog

### [1.0.4] - 2026-06-05
- MAC address field is now truly optional in UI (auto-discovered from IP)
- SmartIR JSON file path is now optional (bundled 1180.json used by default for GREE GWH12-KF-K3DNA5G-I)
- Minimum temperature default changed from 16°C to 8°C in UI

### [1.0.3] - 2026-06-05
- Minimum temperature defaults to anti-frost temperature (8°C) so setpoint is always reachable
- HomeKit status (Active, CurrentTemperature, HeaterCoolerState, RotationSpeed) updated after every IR send
- Explicit state save before anti-frost activation and restore on deactivation
- Bundled GREE 1180.json from SmartIR — no external file needed

### [1.0.2] - 2026-06-05
- MAC address auto-discovered from IP (optional config)
- codes/1180.json bundled in package

### [1.0.1] - 2026-06-05
- MAC address optional — auto-discovered from IP using Broadlink discovery protocol
- Added README with full documentation

### [1.0.0] - 2026-06-05
- Initial release

### [1.0.1] - 2026-06-05
- MAC address is now optional - auto-discovered from IP
- Added README with full documentation

### [1.0.0] - 2026-06-05
- Initial release

## Acknowledgements

- **lprhodes / kiwi-cam** (homebridge-broadlink-rm) - Reference for Broadlink + Homebridge integration
- **mjg59 / python-broadlink** - Protocol documentation used to implement Broadlink UDP communication
- **SmartIR** - IR code file format used by this plugin
