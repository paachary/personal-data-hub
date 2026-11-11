# Advance Tax Help

## Overview

Estimate your advance tax for a financial year (FY), compare the old and new regimes, check instalment shortfalls, and export a summary.

> 🔐 Regular users only. The sysadmin cannot access advance tax data.

## Features

-   **Profile**: enter your tax details for the FY, including the regime choice.
-   **Overview**: see your computed tax, the recommended regime, and the instalment schedule with required, paid and shortfall amounts.
-   **Income, capital gains and payments**: record the income sources, capital gains and advance tax payments that feed the calculation.
-   **Export Excel**: save the overview, instalments, income, capital gains and payments to an `.xlsx` file.
-   **Export Word**: save a summary of the overview to a `.docx` file.
-   **Due date reminders**: turn on the option in **Profile** to create a to-do for each instalment that still has a shortfall. The reminder is set 7 days before the due date.
-   **Dashboard card**: shows the next pending instalment for the current FY.

## Important: Plaintext Data

-   **Exports are not encrypted.** Excel and Word files contain your tax figures in plain text. Store them carefully and delete them when you no longer need them. The app asks you to confirm before each export.
-   **Reminders are stored as normal to-dos.** Their titles are generic, but they are stored in the unencrypted master database. Any local user of this app can see them in **Todos**.
-   Turning reminders off removes only the pending advance tax reminders for that FY. Completed reminders are kept.

## Tips

-   Reminders are created only for instalments that still have a required amount. Instalments that are already past due are skipped.
-   Changing your profile updates the reminders. You do not need to delete them by hand.
-   Advance tax figures are estimates. Check them with a qualified tax professional before you file or pay.
