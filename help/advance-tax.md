# Advance Tax Help

## Overview

Estimate your advance tax for a financial year (FY), compare the old and new regimes, check instalment shortfalls, and export a summary.

> 🔐 Regular users only. The sysadmin cannot access advance tax data.

## Features

-   **Other Income**: record salary, house property, business income, other income sources and capital gains for the FY. These feed the calculation.
-   **Tax Liability**: set your profile (age band, regime choice, deductions, TDS, reminders and dividend forecast), then see the computed tax, the slab-wise tax for the recommended regime and the old vs new regime comparison.
-   **Advance Tax Schedule**: see the instalment due dates with required, paid and shortfall amounts, the estimated 234B and 234C interest, and record advance tax payments. The instalment table is always shown. When no advance tax is due, the reason appears above it and amounts are zero.
-   **Reference**: the slabs, rebate, surcharge, cess, capital gains rates, instalment dates and interest rules used for the selected FY.
-   **Deductions**: 80C, 80CCD(1B) and Section 24(b) home loan interest are capped at their statutory limits (24(b) at 2,00,000 for a self-occupied property). Deductions apply to the old regime only.
-   **Dividend forecast**: when you turn on the option in **Tax Liability** and no dividends are recorded for the FY, the average of the last two FYs is used as the estimate. Forecast dividends are not part of the instalment schedule.
-   **Export Excel**: save the overview, instalments, income, capital gains and payments to an `.xlsx` file.
-   **Export Word**: save a summary of the overview to a `.docx` file.
-   **Due date reminders**: turn on the option in **Tax Liability** to create a to-do for each instalment that still has a shortfall. The reminder is set 7 days before the due date.
-   **Dashboard card**: shows the next pending instalment for the current FY.

> The tax profile was redesigned in this version. Profiles saved in an earlier version are converted automatically the first time the app opens. Your deduction amounts are kept.

## Important: Plaintext Data

-   **Exports are not encrypted.** Excel and Word files contain your tax figures in plain text. Store them carefully and delete them when you no longer need them. The app asks you to confirm before each export.
-   **Reminders are stored as normal to-dos.** Their titles are generic, but they are stored in the unencrypted master database. Any local user of this app can see them in **Todos**.
-   Turning reminders off removes only the pending advance tax reminders for that FY. Completed reminders are kept.

## Tips

-   Reminders are created only for instalments that still have a required amount. Instalments that are already past due are skipped.
-   Changing your profile updates the reminders. You do not need to delete them by hand.
-   Advance tax figures are estimates. Check them with a qualified tax professional before you file or pay.
