# Investments Help

## Overview

Track all your investments linked to your bank accounts.

## Features

-   **Add** an investment (name, reference ID, amount, instrument type, investment type, dates, bank account)
-   **Edit** existing investments
-   **Delete** investments (you are asked to confirm)
-   **Filter** the table by **Bank**, **Instrument** and **Type**
-   **Switch** between **All**, **Active** and **Closed** investments, using the tabs above the table
-   **Export** the visible investments to Excel (`.xlsx`) with **📥 Export to Excel**

## Fields

| Field           | Description                                 |
| --------------- | ------------------------------------------- |
| Investment Name | Label for the investment (required)         |
| Reference ID    | FD receipt, folio number or similar (required) |
| Amount          | Invested amount                             |
| Instrument Type | FD, MF, LIC, NPS, etc.                      |
| Investment Type | Lumpsum, SIP, SWP, STP                      |
| Investment Date | Date of investment (cannot be in the future) |
| Maturity Date   | Expected maturity (optional, must be after today when adding) |
| Bank Account    | Linked bank account                         |

## Status

An investment is **Closed** automatically once its maturity date has passed. You do not need to mark it manually. Investments without a maturity date stay **Active**.

## Tips

-   Closed investments remain in the table with a **Closed** badge. Use the **Closed** tab to see only those.
-   Instrument and investment types come from **Settings** (admin-managed). If a type you need is missing, ask the sysadmin to add it.
-   The sysadmin can see all users' investments in **All Investments** and **Reports**, but cannot edit them.
