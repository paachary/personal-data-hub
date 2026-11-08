# Passwords (Vault) Help

> 🔐 Regular users only. The sysadmin sees a restricted message on this page.

## Overview

Store and manage your sensitive credentials in one place. Entries are encrypted on disk with AES-256-GCM.

## Features

-   **Add** a new entry with **+ Add Entry**. Pick an entry type first, then fill in its fields:
    -   **Bank** – bank name, customer ID, netbanking and mobile banking credentials
    -   **Email** – provider, email address, password, recovery details
    -   **PAN** – PAN number, website password, registered email and mobile
    -   **PRAN** – PRAN number, IPIN, registered email and mobile
    -   **Aadhaar** – Aadhaar number, registered email and mobile, issue date
    -   **Mutual Funds** – fund name, portfolio IDs, user ID, password, mobile PIN
    -   **Passport** – passport number, country, issue and expiry dates
    -   **Visa** – issuing country, visa number and type, control number, issue and expiry dates
    -   **Custom with Expiry** – label, description, custom attributes, issue and expiry dates
    -   **Custom** – label, description, username, password, URL, notes
-   **View** saved entries. Sensitive fields are masked by default.
-   **Edit** existing entries.
-   **Delete** entries (you are asked to confirm).
-   **Copy** a value to the clipboard.
-   **Export** your passwords to a Word (`.docx`) file.

## Tips

-   Use the **eye icon** to reveal or hide a masked field.
-   Use the **copy icon** next to a value to copy it to the clipboard.
-   Entries with an expiry date can generate reminders in **To-Do & Reminders**.
-   Passwords are only visible to the logged-in user.
-   Exported Word files are **not encrypted**. Store them carefully and delete them when you no longer need them.
