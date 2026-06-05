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

### [1.0.1] - 2026-06-05
- MAC address is now optional - auto-discovered from IP
- Added README with full documentation

### [1.0.0] - 2026-06-05
- Initial release

## Acknowledgements

- **lprhodes / kiwi-cam** (homebridge-broadlink-rm) - Reference for Broadlink + Homebridge integration
- **mjg59 / python-broadlink** - Protocol documentation used to implement Broadlink UDP communication
- **SmartIR** - IR code file format used by this plugin
