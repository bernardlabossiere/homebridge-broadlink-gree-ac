# Changelog

## 1.0.30
- Documentation: README updated for RM4 Pro + working temperature sensor


## 1.0.29
- FIXED RM4 Pro temperature & humidity sensor reading (now working!)
- Correct 8-byte packet signature (5aa5aa555aa5aa55) required by RM4 Pro for authentication
- Use correct default AES key for RM4-family firmware
- rmminib payload framing (length-prefixed) for sensor and IR commands
- Room temperature & humidity now reported to HomeKit


## [1.0.11] - 2026-06-05
### Fixed
- Null-safe MAC address in BroadlinkRM.build() using Buffer.alloc(6,0) fallback
- BroadlinkRM constructor now accepts Buffer|null for MAC parameter

## [1.0.10] - 2026-06-05
### Changed
- README changelog updated

## [1.0.9] - 2026-06-05
### Fixed
- Fixed crash: IRCodeManager now uses bundled 1180.json by default when irCodesFile not configured
- irCodesFile config field is now truly optional

## [1.0.8] - 2026-06-05
### Changed
- README changelog updated

## [1.0.7] - 2026-06-05
### Fixed
- IRCodeManager uses bundled 1180.json by default (irCodesFile is optional)

## [1.0.6] - 2026-06-05
### Fixed
- config.schema: MAC Address and SmartIR JSON File Path truly optional (no asterisk)
- Minimum temperature default changed to 8C in UI
- Device Type field hidden from UI

## [1.0.5] - 2026-06-05
### Fixed
- Version bump

## [1.0.4] - 2026-06-05
### Fixed
- MAC address field truly optional in Homebridge UI
- SmartIR JSON file path truly optional
- Minimum temperature default changed from 16C to 8C

## [1.0.3] - 2026-06-05
### Fixed
- Minimum temperature defaults to anti-frost temperature (8C)
- HomeKit status updated after every IR send
- Explicit state save before anti-frost, restore on deactivation
- Bundled GREE 1180.json from SmartIR

## [1.0.2] - 2026-06-05
### Changed
- codes/1180.json bundled in package

## [1.0.1] - 2026-06-05
### Fixed
- MAC address optional, auto-discovered from IP

## [1.0.0] - 2026-06-05
### Added
- Initial release
- HeaterCooler service (heat/cool/auto + fan speed)
- Anti-frost switch
- SmartIR JSON code file support
- Native Broadlink UDP protocol implementation
