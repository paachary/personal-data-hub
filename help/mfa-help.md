# MFA Guide Help

## Overview

Two-Factor Authentication (MFA) adds a second step to logging in. After you enter your password, the app asks for a 6-digit code from an authenticator app on your phone.

## Set Up MFA

1. Install an authenticator app, such as **Google Authenticator** or **Microsoft Authenticator**.
2. On the setup screen, scan the **QR code** with the app. Choose **Scan QR Code** in the app. If you can't scan it, enter the key shown on screen manually.
3. Enter the **6-digit code** shown in the app. Codes refresh every **30 seconds**.

## Log In With MFA

1. Enter your username and password.
2. Enter the current 6-digit code from your authenticator app.

## Keep Your Device Safe

-   Do not share your QR code or manual key with anyone.
-   Turn on a lock-screen PIN on your phone.

## Lost Access to Your Authenticator?

If you can no longer get codes, you cannot log in. Ask the sysadmin to reset your MFA. The sysadmin does this from **User Management**. After the reset, you set up MFA again on your next login.

## Tips

-   Check that your phone's clock is set automatically. Wrong time causes codes to fail.
-   If a code is rejected, wait for the next code and try again.
