# Changelog

All notable changes to **Salesforce Access Studio** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Planned
- Tab Permissions editor
- Record Type Visibility editor
- User Permissions handler (UI exists, handler is empty)
- Permission Set Group support (`.permissionsetgroup-meta.xml`)
- Dry-run / preview mode before writing files
- Configurable backend port for the Bulk File Uploader
- Retry logic for failed uploads in the Bulk File Uploader
- CSV export of bulk update results
- Diff view showing which XML lines changed per file

---

## [0.0.5] — 2024

### Added
- **Apex Class Permissions** — new permission type in the Permission Manager; enter class names and set Enabled/Disabled across multiple Profiles or Permission Sets at once.
- Extension rebranded internally to **Salesforce Access Studio**.

### Changed
- Improved XML insertion fallback logic: permissions now insert before the closing `</PermissionSet>` or `</Profile>` tag when no sibling elements are found, preventing insertion failures on minimal or sparse metadata files.
- XML utilities now detect and preserve the file's original line ending (CRLF vs LF) on write.

### Fixed
- Indentation detection now reads from existing XML elements rather than assuming a fixed number of spaces.
- XML special characters (`&`, `<`, `>`, `"`, `'`) in permission names are now properly escaped before insertion.

---

## [0.0.4] — 2024

### Added
- **Bulk File Uploader** — a new command (`Salesforce: Launch Bulk File Uploader`) that spawns a local FastAPI backend and opens a three-step web UI inside a VS Code Webview panel.
  - Step 1: Authenticate to a Salesforce org via OAuth2 Client Credentials (Client ID + Secret).
  - Step 2: Optionally configure an object and field for automatic file-to-record linking.
  - Step 3: Select files, set thread count (1–10), upload with a live progress bar.
- Backend streams output to a dedicated VS Code Output Channel ("Permission Manager Backend").
- Backend process is automatically terminated on extension deactivation.

### Changed
- Extension now registers two commands in the Command Palette instead of one.

---

## [0.0.3] — 2024

### Added
- **Layout Assignments** — new permission type; enter layout names and optional matching record type names (one-to-one). Idempotent: duplicate exact assignments are not re-inserted.
- **Custom Permissions** — new permission type; enter custom permission API names and set Enabled/Disabled.
- Multi-select file picker: users can now select multiple `.profile-meta.xml` or `.permissionset-meta.xml` files in a single operation and apply the same permission update to all of them.
- Summary notification after bulk update: reports updated / unchanged / failed counts per run.

### Changed
- Confirmation dialog now shows a summary of the selected files and the intended change before writing anything.

---

## [0.0.2] — 2024

### Added
- **Object Permissions** — supports all seven permission flags: `allowCreate`, `allowDelete`, `allowEdit`, `allowRead`, `modifyAllRecords`, `viewAllFields`, `viewAllRecords`. Multi-select UI for CRUD and additional permissions.
- Smart insertion: new permission blocks are inserted adjacent to existing blocks of the same type when possible, keeping the XML logically grouped.

### Fixed
- Field permission update no longer creates duplicate `<fieldPermissions>` blocks when the field already exists; it now updates the existing block in-place.

---

## [0.0.1] — 2024

### Added
- Initial release.
- **Permission Manager** command — open a folder, pick `.profile-meta.xml` or `.permissionset-meta.xml` files, and apply bulk permission changes without connecting to a Salesforce org.
- **Field Permissions** — enter fields in `Object.FieldName` format, choose Read Only / Read + Write / Write Only.
- File scanner discovers all Salesforce metadata files in the selected folder.
- Preserves original XML structure; does not reformat or sort unrelated elements.

---

[Unreleased]: https://github.com/SourabhMulay/PermissionManager/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/SourabhMulay/PermissionManager/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/SourabhMulay/PermissionManager/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/SourabhMulay/PermissionManager/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/SourabhMulay/PermissionManager/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/SourabhMulay/PermissionManager/releases/tag/v0.0.1
