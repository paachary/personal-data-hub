<p align="center">
  <img src="build/icon.png" width="96" alt="Personal Data Hub icon" />
</p>

<h1 align="center">Personal Data Hub</h1>

<p align="center">
  A secure, offline-first desktop application for managing your sensitive personal information.
  <br />
  Passwords · Notes · To-Do Reminders · Bank Accounts · Investments
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.2.0-blue" />
  <img src="https://img.shields.io/badge/electron-41-47848F?logo=electron" />
  <img src="https://img.shields.io/badge/next.js-16-black?logo=next.js" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" />
  <img src="https://img.shields.io/badge/license-Private-red" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
    - [macOS](#macos)
    - [Windows](#windows)
    - [Linux](#linux)
- [Build from Source](#build-from-source)
    - [Prerequisites](#prerequisites)
    - [Setup](#setup)
    - [Development](#development)
    - [Building Distributables](#building-distributables)
- [Data Storage](#data-storage)
- [Security](#security)
- [Tech Stack](#tech-stack)
- [Application Access](#application-access)
    - [First Launch](#first-launch--create-sysadmin)
    - [Roles & Responsibilities](#-roles--responsibilities)
        - [Sysadmin](#-sysadmin)
        - [Regular User](#-regular-user)
    - [Reports (Sysadmin Only)](#-reports-sysadmin-only)
- [Statement Import & Analytics](#statement-import--analytics)
- [Known Limitations](#known-limitations)
- [Author](#author)

---

## Overview

**Personal Data Hub** is a private, offline-first Electron + Next.js desktop application. All data is encrypted using AES and stored locally on your machine. Nothing is ever transmitted to external servers.

It is designed as a single, unified place to store:

- Login credentials across categorised vault types (Bank, Email, PAN, Aadhaar, Passport, Mutual Funds, and more)
- Secure private notes with custom attributes and tags
- To-do tasks with prioritisation, due dates, and desktop reminder notifications
- Bank accounts and financial institution details
- Investment portfolio tracking across all instruments
- Bank statement imports with balance, credit and debit analytics
- Admin reports on investments and monthly debits

---

## Features

| Feature                  | Description                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| 🔑 **Password Vault**    | Categorised credential storage with masked fields and Word export                                 |
| 📝 **Secure Notes**      | Private notes with tags, custom key-value attributes, and Word export                             |
| 📋 **To-Do & Reminders** | Tasks with priority, due dates, desktop notifications, and auto-reminders from vault expiry dates |
| 🏦 **Banks & Accounts**  | Track bank accounts and balances                                                                  |
| 📈 **Investments**       | Full portfolio tracking with instrument and investment type management                            |
| 📊 **Investment Charts** | Donut chart showing distribution by instrument type — syncs with the active/closed filter         |
| 📥 **Statement Import**  | Import CSV and Excel (.xlsx/.xls) bank statements, with bank-specific layouts for HDFC, ICICI, SBI, Union Bank and Standard Chartered, a generic fallback, and duplicate detection |
| 📉 **Spending Analytics** | Weekly, monthly and yearly summaries, trend charts, opening/closing balance and credit/debit totals |
| 📑 **Reports**           | Sysadmin reports: all active investments, SIP-only investments, monthly debit summary by user and by bank |
| 📤 **Excel Export**      | Export investments to XLSX                                                                        |
| 🧾 **Advance Tax**       | Per-FY advance tax estimate, old vs new regime, instalment shortfalls, optional due-date reminders, Excel and Word export (see [Advance Tax](#advance-tax)) |
| 🌍 **Location Dropdowns** | Country, state and city pickers on registration and profile (uses an online lookup, see [Security](#security)) |
| 🔐 **MFA**               | TOTP-based Two-Factor Authentication (Google Authenticator, Authy, etc.)                          |
| 🛡️ **Password Policy**   | 8–50 characters with uppercase, lowercase, number and special character required                 |
| 👥 **Admin Panel**       | User management, password resets, master data configuration                                       |
| ⏱ **Inactivity Logout**  | Auto-logout after 5 minutes of inactivity                                                         |
| 🌙 **Dark UI**           | Fully dark-themed interface                                                                       |

---

## Installation

### macOS

1. Download the latest `Personal Data Hub-x.x.x.dmg` from the releases
2. Open the `.dmg` file
3. Drag **Personal Data Hub** into your Applications folder
4. Open the app — if macOS blocks it, go to **System Settings → Privacy & Security → Open Anyway**

> **Note:** The app is not notarised. You may need to right-click → Open on first launch.

---

### Windows

1. Download the latest `Personal Data Hub Setup x.x.x.exe` from the releases
2. Run the installer
3. Follow the on-screen prompts
4. Launch **Personal Data Hub** from the Start Menu or Desktop shortcut

> **Note:** Windows Defender SmartScreen may warn about an unknown publisher. Click **More info → Run anyway**.

---

### Linux

1. Download the latest `personal-data-x.x.x.AppImage` or `.deb` from the releases

#### AppImage

```bash
chmod +x personal-data-x.x.x.AppImage
./personal-data-x.x.x.AppImage --no-sandbox
```

#### .deb (Debian / Ubuntu)

```bash
sudo dpkg -i personal-data-x.x.x.deb
personal-data --no-sandbox

```

#### Required system libraries

```bash
# Debian / Ubuntu
sudo apt install -y \
  libsecret-1-dev \
  libsecret-tools \
  gnome-keyring \
  libnotify-bin \
  libnss3 \
  libatk-bridge2.0-0 \
  libgtk-3-0 \
  libgbm1 \
  libasound2

# Fedora / RHEL
sudo dnf install -y \
  libsecret-devel \
  gnome-keyring \
  libnotify \
  nss \
  atk \
  gtk3 \
  mesa-libgbm \
  alsa-lib

# Arch Linux
sudo pacman -S \
  libsecret \
  gnome-keyring \
  libnotify \
  nss \
  gtk3 \
  alsa-lib
```

> **Note:** `libsecret` and `gnome-keyring` are required for the OS keychain. `libnotify` is required for desktop reminder notifications.

---

## Build from Source

### Prerequisites

| Requirement                         | Version                                |
| ----------------------------------- | -------------------------------------- |
| Node.js                             | >= 18.x                                |
| npm                                 | >= 9.x                                 |
| Python                              | >= 3.x (for native module compilation) |
| Xcode CLI (macOS)                   | Latest                                 |
| Visual Studio Build Tools (Windows) | 2019 or later                          |
| GCC / G++ (Linux)                   | Latest via `build-essential`           |

#### Linux — additional build dependencies

```bash
sudo apt install -y \
  build-essential \
  libsecret-1-dev \
  python3
```

---

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/paachary/personal-data-hub.git
cd personal-data-hub

# 2. Install dependencies
npm install

# 3. Rebuild native modules for Electron
npm run postinstall
```

---

### Development

Runs Next.js (port 4000) and Electron concurrently. Port 4000 must be free before you start:

```bash
npm run dev
```

---

### Building Distributables

```bash
# macOS — produces .dmg and .zip in /dist
npm run dist:mac

# Windows — produces .exe NSIS installer in /dist
npm run dist:win

# Linux — produces .AppImage and .deb in /dist
npm run dist:linux
```

> Output is placed in the `dist/` folder.

---

## Data Storage

All application data is stored **locally** on your device:

| Platform | Location                                           |
| -------- | -------------------------------------------------- |
| macOS    | `~/Library/Application Support/Personal Data Hub/` |
| Windows  | `%APPDATA%\Personal Data Hub\`                     |
| Linux    | `~/.config/personal-data-hub/`                     |

Inside that folder, the app keeps:

| File | Contents |
| ---- | -------- |
| `data/master.db` | Users, to-do list |
| `data/vault_<username>.json` | Each user's encrypted passwords and notes |
| `data/finance.db` | Encrypted bank, account, investment and statement data |

Encryption keys are kept in the OS keychain, not in these files. Deleting the data folder without also removing the keychain entries leaves orphaned keys.

To fully reset the application (wipe all data):

```bash
# macOS
rm -rf ~/Library/Application\ Support/Personal\ Data\ Hub/

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:APPDATA\Personal Data Hub"

# Linux
rm -rf ~/.config/personal-data-hub/
```

---

## Security

- Vault entries and secure notes are **AES-256-GCM encrypted** before being written to disk
- Finance data (banks, accounts, investments, statements) is stored in an **encrypted SQLite database**
- Encryption keys are stored in the **OS keychain** via [Keytar](https://github.com/atom/node-keytar)
- Passwords are stored as PBKDF2 hashes, not in plain text
- TOTP-based **MFA** support via [Speakeasy](https://github.com/speakeasy-userland/speakeasy)
- **Inactivity timeout** — automatic logout after 5 minutes of inactivity
- **Export warning:** Word and Excel exports write **unencrypted** files to the location you choose. Store and delete them carefully.
- **One network feature:** the country, state and city dropdowns on registration and profile call a public lookup API (`countriesnow.space`). Only location names are sent. No personal data or vault content is sent. The rest of the app works offline.

See [Known Limitations](#known-limitations) for security gaps that are still open.

---

## Tech Stack

| Layer                             | Technology                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Desktop shell                     | Electron 41                                                                   |
| Frontend                          | Next.js 16, React 19                                                          |
| Database (accounts & investments) | SQLite via better-sqlite3 (AES-encrypted via better-sqlite3-multiple-ciphers) |
| Vault & notes storage             | AES-256-GCM encrypted JSON file, one per user (`vault_<username>.json`), Node `crypto` |
| Password hashing                  | PBKDF2-SHA512 via Node `crypto`                                               |
| Statement parsing                 | csv-parse, xlsx (PDF parsing code exists but import is disabled)              |
| Excel export                      | xlsx                                                                          |
| Other                             | marked (help pages), qrcode (MFA setup)                                       |
| Keychain                          | keytar                                                                        |
| MFA                               | speakeasy, qrcode                                                             |
| Charts                            | recharts                                                                      |
| Document export                   | docx                                                                          |

---

## Application Access

### First Launch — Create Sysadmin

- Create the **sysadmin** account:
    - Username: `sysadmin`
    - Check **"Register as Admin"** ✅
- Log in with the sysadmin credentials.

> ⚠️ **The sysadmin account must be created before any regular users.**

---

### 👤 Roles & Responsibilities

#### 🔐 Sysadmin

The sysadmin is the administrator of the app. The app is designed for a single admin account, but this is **not yet enforced in code**.

**Sysadmin can:**

- Create and manage **user accounts**
- Reset user **passwords**
- Reset user **MFA**
- Manage **Bank Master** data (add/edit/delete banks)
- Manage **Instrument Types** (FD, MF, LIC, etc.)
- Manage **Investment Types** (Lumpsum, SIP, etc.)
- View **all users' bank accounts and investments**
- View **Investment Reports** across all users
- Sysadmin **cannot** access passwords, notes, or todos. The dashboard hides these sections for the sysadmin. This block is currently applied in the UI only (see [Known Limitations](#known-limitations)).

---

#### 👥 Regular User

Regular users manage their own personal data privately.

**Regular users can:**

- Manage their **Passwords** (vault)
- Manage their **Notes**
- Manage their **Todos & Reminders**
- Manage their **Bank Accounts**
- Manage their **Investments**
- View their own **Investment summary**
- Set up and use **MFA (Multi-Factor Authentication)**

---

### 📊 Reports (Sysadmin Only)

The sysadmin sees **📊 Reports** under the Finance group in the sidebar. It contains:

- **All Active Investments:** investments across all users, grouped by instrument type (FD, MF, LIC, etc.), with a donut chart that follows the active/closed filter
- **SIP Only:** SIP investments across users
- **Monthly Debit Summary by User:** monthly debits per user, grouped by bank, with sorting and collapsible sections
- **Monthly Debit Summary:** monthly debit totals across users

Investment data can be exported to XLSX.

---

## Statement Import & Analytics

Available on the **Statements** page for each bank account.

1. Choose a bank and file type (CSV or Excel).
2. Select the file. The app parses the opening and closing balance, totals, and every transaction.
3. Transactions are checked for duplicates using a fingerprint. Re-importing the same statement does not create duplicates.
4. Weekly, monthly and yearly summaries are rebuilt for the account.
5. Use the trend chart and transaction list to review spending over a date range.

Supported bank layouts: HDFC, ICICI, SBI, Union Bank of India and Standard Chartered, in CSV and Excel. Other banks use the generic CSV or Excel parser, which works only if the columns match its expected layout.

> **PDF statements are not supported yet.** The import screen rejects PDF files. Export your statement as CSV or Excel from your bank's portal.

---

## Advance Tax

Available on the **Advance Tax** page for regular users. The sysadmin cannot access it.

1. Enter your tax profile for the financial year (FY) on the **Profile** tab.
2. Record income, capital gains and advance tax payments. The **Overview** tab shows the computed tax, the recommended regime and the instalment schedule with shortfalls.
3. Turn on **Create reminders for advance tax due dates** in **Profile** to add a to-do for each instalment with an outstanding amount, set 7 days before its due date.
4. Use **Export Excel** or **Export Word** on the **Overview** tab to save a summary.

> **Plaintext warning.** Exported Excel and Word files are not encrypted. Reminders are stored as normal to-dos in the unencrypted master database and are visible to any local user. The app asks you to confirm before each export.

---

## Known Limitations

These are known gaps in the current version. Most are tracked in `AGENTS.md`.

- **Sysadmin block is UI-only.** The dashboard hides passwords, notes and to-dos for the sysadmin, but the app's backend does not yet block those calls.
- **Multiple sysadmins are possible.** Nothing stops a second admin account from being created.
- **MFA is not enforced for data access.** It gates the login screen flow only.
- **Shared to-dos.** To-do items are stored in one shared list, not per user.
- **Vault reminders** from expiry dates are created once per entry. The `issueDate` field is treated like an expiry date. Check reminder dates after adding vault entries.
- **PDF statements are not supported.** Import accepts CSV and Excel only.
- **Password hashing** uses PBKDF2 with a low iteration count.
- **Plain-text exports.** Word and Excel exports are not encrypted.
- **Country, state and city lookup** needs internet access. All other features work offline.
- **Linux** requires a running secret service (`gnome-keyring` or similar) for the keychain. The app may need `--no-sandbox` to start from an AppImage.
- **Not notarised.** macOS and Windows will show security warnings on first launch.

---

---

## Author

**Prashant Acharya**

- Email: [prashant_acharya74@yahoo.com](mailto:prashant_acharya74@yahoo.com)
- GitHub: [https://github.com/paachary](https://github.com/paachary)

---

> This is a **private** project. Do not distribute or share without permission.
