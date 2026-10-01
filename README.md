# Salesforce Access Studio

> A VS Code extension for managing Salesforce Profile and Permission Set metadata — bulk, offline, no org connection required.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Commands](#commands)
- [Permission Manager — How to Use](#permission-manager--how-to-use)
  - [Field Permissions](#1-field-permissions)
  - [Object Permissions](#2-object-permissions)
  - [Apex Class Permissions](#3-apex-class-permissions)
  - [Custom Permissions](#4-custom-permissions)
  - [Layout Assignments](#5-layout-assignments)
- [Bulk File Uploader — How to Use](#bulk-file-uploader--how-to-use)
- [Supported Metadata Types](#supported-metadata-types)
- [Known Limitations & Roadmap](#known-limitations--roadmap)
- [Contributing & Suggestions](#contributing--suggestions)
- [Requirements](#requirements)

---

## Overview

**Salesforce Access Studio** gives you two tools in one extension:

1. **Permission Manager** — Edit Salesforce metadata XML files (Profiles and Permission Sets) locally, in bulk, without deploying to or connecting to an org. Select multiple files, pick the permission type, fill in the details — done.

2. **Bulk File Uploader** — Upload files to a Salesforce org in bulk via the REST API, with optional automatic record linking using SOQL queries. Runs a lightweight FastAPI backend inside VS Code.

---

## Features

| Feature | Permission Manager | Bulk File Uploader |
|---|---|---|
| Works offline | ✅ | ❌ (requires org) |
| Bulk multi-file updates | ✅ | ✅ |
| Field Permissions | ✅ | — |
| Object Permissions (CRUD) | ✅ | — |
| Apex Class Access | ✅ | — |
| Custom Permissions | ✅ | — |
| Layout Assignments | ✅ | — |
| Upload files to Salesforce org | — | ✅ |
| Threaded uploads (1–10 threads) | — | ✅ |
| Auto-link files to records | — | ✅ |
| Live progress tracking | — | ✅ |

---

## Installation

1. Download the `.vsix` file from the [Releases](https://github.com/SourabhMulay/PermissionManager/releases) page.
2. Open VS Code → Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **"Extensions: Install from VSIX..."** and select the downloaded file.
4. Reload VS Code if prompted.

**For the Bulk File Uploader**, Python 3 must be installed and available on your `PATH`. The extension will handle installing Python dependencies automatically on first launch.

---

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for:

| Command | Description |
|---|---|
| `Salesforce: Permission Manager` | Open the guided permission editor for Profiles and Permission Sets |
| `Salesforce: Launch Bulk File Uploader` | Launch the web UI for uploading files to a Salesforce org |

---

## Permission Manager — How to Use

**Step-by-step:**

1. Open the Command Palette and run `Salesforce: Permission Manager`.
2. A folder picker opens. Select the folder containing your `.profile-meta.xml` or `.permissionset-meta.xml` files.
3. From the list of discovered files, select one or more to update (multi-select supported).
4. Choose the permission type you want to modify.
5. Fill in the prompts specific to that permission type (see sections below).
6. Confirm the operation in the summary dialog.
7. The extension reads, updates, and writes each XML file. A summary notification reports how many files were updated, unchanged, or failed.

> **Note:** The extension preserves your file's existing line endings (CRLF/LF) and indentation style. It does not reformat the file.

---

### 1. Field Permissions

Update `<fieldPermissions>` blocks inside Profile or Permission Set XML files.

**How to enter fields:**
- Enter field API names in `Object.FieldName` format, separated by commas.
- Example: `Account.Phone, Contact.Email__c, Opportunity.CloseDate`

**Permission levels:**

| Option | `<readable>` | `<editable>` |
|---|---|---|
| Read Only | `true` | `false` |
| Read + Write | `true` | `true` |
| Write Only | `false` | `true` |

**Behavior:**
- If the field already exists in the XML, its values are updated in-place.
- If the field does not exist, a new `<fieldPermissions>` block is inserted, grouped with other fields for the same object.

---

### 2. Object Permissions

Update `<objectPermissions>` blocks for standard and custom Salesforce objects.

**How to enter objects:**
- Enter object API names separated by commas.
- Example: `Account, Contact, My_Custom_Object__c`

**CRUD permissions** (multi-select, choose any combination):
- Create
- Read
- Edit
- Delete

**Additional permissions** (multi-select, choose any combination):
- View All Fields
- Modify All Records
- View All Records

**Behavior:**
- All 7 boolean tags (`allowCreate`, `allowDelete`, `allowEdit`, `allowRead`, `modifyAllRecords`, `viewAllFields`, `viewAllRecords`) are written.
- If the object block already exists, it is updated in-place.

---

### 3. Apex Class Permissions

Update `<classAccesses>` blocks to grant or revoke access to Apex classes.

**How to enter classes:**
- Enter Apex class names separated by commas.
- Names must match the pattern `^[a-zA-Z_][a-zA-Z0-9_]*$` (standard Apex naming).
- Example: `MyController, BatchJobHandler, RestApiService`

**Access options:**
- **Enabled** — sets `<enabled>true</enabled>`
- **Disabled** — sets `<enabled>false</enabled>`

---

### 4. Custom Permissions

Update `<customPermissions>` blocks to grant or revoke named custom permissions.

**How to enter custom permissions:**
- Enter custom permission API names separated by commas.
- Example: `Can_Approve_Records, View_Finance_Dashboard`

**Access options:**
- **Enabled** — sets `<enabled>true</enabled>`
- **Disabled** — sets `<enabled>false</enabled>`

---

### 5. Layout Assignments

Insert `<layoutAssignments>` blocks linking layouts (and optionally record types) to a Profile.

**How to enter layouts:**
- Enter layout names separated by commas.
- Example: `Account-Account Layout, Account-RES Company`

**Optionally, add record types:**
- Enter record type API names in matching order (one per layout), separated by commas.
- Example: `Account.RES_Company, Account.RES_Individual`
- The count of record types must match the count of layouts exactly.
- If no record types are provided, `<layoutAssignments>` blocks are written without a `<recordType>` tag.

**Behavior:**
- Duplicate assignments (exact match) are not written again — the operation is idempotent.

---

## Bulk File Uploader — How to Use

The Bulk File Uploader connects to your Salesforce org and uploads files as `ContentVersion` records, with optional automatic linking to existing records.

**Requirements:**
- Python 3 installed and on your `PATH`
- A Salesforce Connected App with OAuth2 Client Credentials flow enabled

**Step 1 — Launch:**

Run `Salesforce: Launch Bulk File Uploader` from the Command Palette. The extension will:
- Check for Python 3
- Install Python dependencies (`fastapi`, `uvicorn`, `requests`, etc.) if needed
- Start the local backend server on port 8000
- Open a web UI panel inside VS Code

**Step 2 — Connect to Salesforce:**

In the web UI, enter:
- **Org URL** — your Salesforce instance URL (e.g., `https://yourorg.my.salesforce.com`)
- **Client ID** — from your Connected App
- **Client Secret** — from your Connected App

Click **Connect**. The extension authenticates using the OAuth2 Client Credentials flow.

**Step 3 — Configure File Relationships (Optional):**

If you want uploaded files to be automatically linked to Salesforce records:
- Enter the **Object API Name** (e.g., `Account`)
- Enter the **Matching Field API Name** — the field whose value will be matched against the uploaded filename (e.g., `Name`)
- The extension queries Salesforce using SOQL to find matching records and creates `ContentDocumentLink` records automatically.

Choose **File Visibility**:
- `AllUsers` — visible to all users
- `InternalUsers` — visible to internal users only
- `SharedUsers` — visible to shared/community users

**Step 4 — Select & Upload Files:**

- Click **Select Files** and pick one or more files.
- Set the **Thread Count** (1–10) to control parallel upload speed.
- Click **Upload**. A live progress bar tracks the operation.
- After completion, a summary shows total / uploaded / failed counts, and a per-file result list.

> **Backend:** The backend runs locally at `http://localhost:8000` and is automatically stopped when you close VS Code or reload the extension.

---

## Supported Metadata Types

| File Extension | Metadata Type |
|---|---|
| `*.profile-meta.xml` | Salesforce Profile |
| `*.permissionset-meta.xml` | Salesforce Permission Set |

---

## Known Limitations & Roadmap

This extension is under active development. A lot is on the table — here are known gaps and things we're actively thinking about. **We welcome your input on all of them.**

### Not Yet Implemented

- **Tab Permissions** — UI mention exists but the feature is not yet built.
- **Record Type Visibility** — Listed as a planned feature; not yet implemented.
- **User Permissions** — The permission type appears in the UI but the handler is empty; not functional yet.
- **Permission Set Groups** — No support for `.permissionsetgroup-meta.xml` files yet.
- **Muting Permission Sets** — Not handled.

### Known Bugs / Rough Edges

- The Bulk File Uploader backend uses a **single in-memory session** — running multiple VS Code windows or concurrent users would share the same Salesforce session.
- No retry logic for failed file uploads in the Bulk File Uploader.
- Port 8000 is hardcoded for the backend. If another process is already using it, the uploader will fail silently.
- The extension has no mechanism to validate whether entered field or object API names actually exist in your org.
- Layout assignment insertion is append-only; there is no UI to remove or replace existing layout assignments.

### Ideas We're Considering

- Dry-run / preview mode — show what would change before writing any files.
- Undo support — restore original XML after a bulk update.
- Support for `.permissionsetgroup-meta.xml` and muting permission sets.
- Tab visibility and Record Type visibility editors.
- A diff view showing exactly which XML lines changed.
- Configurable backend port for the Bulk File Uploader.
- Export a CSV report of what was changed across which files.
- Validation against a local `sfdx-project.json` or org describe to catch typos in API names.
- Support for Named Credentials, Connected App permissions, and other metadata types.

---

## Contributing & Suggestions

This project is open to contributions, bug reports, and feature suggestions.

**Have an idea or found a bug?**
👉 [Open an issue on GitHub](https://github.com/SourabhMulay/PermissionManager/issues)

We are especially interested in:
- Feature requests for permission types not yet covered
- Edge cases in XML formatting that break the editor
- Feedback on the Bulk File Uploader UX
- Suggestions for org-connected validation features

Pull requests are welcome. Please open an issue first to discuss significant changes.

---

## Requirements

| Requirement | Details |
|---|---|
| VS Code | 1.125.0 or later |
| Salesforce DX project | Any SFDX project with metadata XML files |
| Python 3 | Required only for the Bulk File Uploader |
| Salesforce Connected App | Required only for the Bulk File Uploader (OAuth2 Client Credentials) |

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

*Built with care for Salesforce developers who spend too much time hand-editing XML.*
