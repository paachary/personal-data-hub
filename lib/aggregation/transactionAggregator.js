/**
 * Transaction Aggregation Service
 * Computes daily, weekly, monthly, and yearly summaries for trend analysis
 */
class TransactionAggregator {
    constructor(db) {
        this.db = db;
    }

    /**
     * Aggregate transactions for an account across all time periods
     * Recomputes all summary tables for the given account
     * @param {number} accountId - Account ID
     * @param {string} fromDate - Optional: only aggregate from this date (YYYY-MM-DD)
     * @param {string} toDate - Optional: only aggregate to this date (YYYY-MM-DD)
     * @returns {Object} Aggregation results { daily: count, weekly: count, monthly: count, yearly: count }
     */
    aggregateTransactions(accountId, fromDate = null, toDate = null) {
        try {
            // Fetch all transactions for this account
            let query = `SELECT date, debit, credit FROM transactions WHERE account_id = ?`;
            const params = [accountId];

            if (fromDate) {
                query += ` AND date >= ?`;
                params.push(fromDate);
            }
            if (toDate) {
                query += ` AND date <= ?`;
                params.push(toDate);
            }

            query += ` ORDER BY date ASC`;

            const transactions = this.db.prepare(query).all(...params);

            if (transactions.length === 0) {
                return { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
            }

            // Compute daily summaries
            const dailyCount = this.aggregateDaily(accountId, transactions);

            // Compute weekly summaries
            const weeklyCount = this.aggregateWeekly(accountId, transactions);

            // Compute monthly summaries
            const monthlyCount = this.aggregateMonthly(accountId, transactions);

            // Compute yearly summaries
            const yearlyCount = this.aggregateYearly(accountId, transactions);

            return {
                daily: dailyCount,
                weekly: weeklyCount,
                monthly: monthlyCount,
                yearly: yearlyCount,
            };
        } catch (error) {
            console.error(
                "[TransactionAggregator] Error aggregating transactions:",
                error,
            );
            throw error;
        }
    }

    /**
     * Aggregate transactions to daily summaries
     * Computes total debit, credit, net for each day
     * @param {number} accountId - Account ID
     * @param {Object[]} transactions - Transactions to aggregate
     * @returns {number} Number of daily records created/updated
     */
    aggregateDaily(accountId, transactions) {
        const dailyMap = {};

        // Group transactions by date
        for (const txn of transactions) {
            const date = txn.date;

            if (!dailyMap[date]) {
                dailyMap[date] = {
                    account_id: accountId,
                    date,
                    total_debits: 0,
                    total_credits: 0,
                    txn_count: 0,
                };
            }

            dailyMap[date].total_debits += txn.debit || 0;
            dailyMap[date].total_credits += txn.credit || 0;
            dailyMap[date].txn_count += 1;
        }

        // Upsert into database
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO transaction_summaries 
            (account_id, date, total_debits, total_credits, net, txn_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        let count = 0;
        for (const [date, totals] of Object.entries(dailyMap)) {
            const net = totals.total_credits - totals.total_debits;
            stmt.run(
                totals.account_id,
                date,
                totals.total_debits,
                totals.total_credits,
                net,
                totals.txn_count,
            );
            count++;
        }

        return count;
    }

    /**
     * Aggregate transactions to weekly summaries
     * Week starts on Monday (ISO 8601)
     * @param {number} accountId - Account ID
     * @param {Object[]} transactions - Transactions to aggregate
     * @returns {number} Number of weekly records created/updated
     */
    aggregateWeekly(accountId, transactions) {
        const weeklyMap = {};

        // Group transactions by week
        for (const txn of transactions) {
            const weekStart = this.getWeekStartDate(txn.date);

            if (!weeklyMap[weekStart]) {
                weeklyMap[weekStart] = {
                    account_id: accountId,
                    week_start_date: weekStart,
                    total_debits: 0,
                    total_credits: 0,
                    txn_count: 0,
                };
            }

            weeklyMap[weekStart].total_debits += txn.debit || 0;
            weeklyMap[weekStart].total_credits += txn.credit || 0;
            weeklyMap[weekStart].txn_count += 1;
        }

        // Upsert into database
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO transaction_summaries_weekly
            (account_id, week_start_date, total_debits, total_credits, net, txn_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        let count = 0;
        for (const [weekStart, totals] of Object.entries(weeklyMap)) {
            const net = totals.total_credits - totals.total_debits;
            stmt.run(
                totals.account_id,
                weekStart,
                totals.total_debits,
                totals.total_credits,
                net,
                totals.txn_count,
            );
            count++;
        }

        return count;
    }

    /**
     * Aggregate transactions to monthly summaries
     * @param {number} accountId - Account ID
     * @param {Object[]} transactions - Transactions to aggregate
     * @returns {number} Number of monthly records created/updated
     */
    aggregateMonthly(accountId, transactions) {
        const monthlyMap = {};

        // Group transactions by year-month
        for (const txn of transactions) {
            const yearMonth = txn.date.substring(0, 7); // YYYY-MM

            if (!monthlyMap[yearMonth]) {
                monthlyMap[yearMonth] = {
                    account_id: accountId,
                    year_month: yearMonth,
                    total_debits: 0,
                    total_credits: 0,
                    txn_count: 0,
                };
            }

            monthlyMap[yearMonth].total_debits += txn.debit || 0;
            monthlyMap[yearMonth].total_credits += txn.credit || 0;
            monthlyMap[yearMonth].txn_count += 1;
        }

        // Upsert into database
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO transaction_summaries_monthly
            (account_id, year_month, total_debits, total_credits, net, txn_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        let count = 0;
        for (const [yearMonth, totals] of Object.entries(monthlyMap)) {
            const net = totals.total_credits - totals.total_debits;
            stmt.run(
                totals.account_id,
                yearMonth,
                totals.total_debits,
                totals.total_credits,
                net,
                totals.txn_count,
            );
            count++;
        }

        return count;
    }

    /**
     * Aggregate transactions to yearly summaries
     * @param {number} accountId - Account ID
     * @param {Object[]} transactions - Transactions to aggregate
     * @returns {number} Number of yearly records created/updated
     */
    aggregateYearly(accountId, transactions) {
        const yearlyMap = {};

        // Group transactions by year
        for (const txn of transactions) {
            const year = parseInt(txn.date.substring(0, 4), 10);

            if (!yearlyMap[year]) {
                yearlyMap[year] = {
                    account_id: accountId,
                    year,
                    total_debits: 0,
                    total_credits: 0,
                    txn_count: 0,
                };
            }

            yearlyMap[year].total_debits += txn.debit || 0;
            yearlyMap[year].total_credits += txn.credit || 0;
            yearlyMap[year].txn_count += 1;
        }

        // Upsert into database
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO transaction_summaries_yearly
            (account_id, year, total_debits, total_credits, net, txn_count, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        let count = 0;
        for (const [year, totals] of Object.entries(yearlyMap)) {
            const net = totals.total_credits - totals.total_debits;
            stmt.run(
                totals.account_id,
                year,
                totals.total_debits,
                totals.total_credits,
                net,
                totals.txn_count,
            );
            count++;
        }

        return count;
    }

    /**
     * Get week start date (Monday) in ISO format for a given date
     * Uses ISO 8601 week definition
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @returns {string} Week start date in YYYY-MM-DD format
     */
    getWeekStartDate(dateStr) {
        const date = new Date(dateStr + "T00:00:00Z");
        const day = date.getUTCDay();

        // ISO week: Monday = 1, Sunday = 0
        // Convert: Sunday (0) -> 7, then subtract (day - 1) to get Monday
        const diff = date.getUTCDate() - (day === 0 ? 6 : day - 1);
        const weekStart = new Date(date);
        weekStart.setUTCDate(diff);

        const year = weekStart.getUTCFullYear();
        const month = String(weekStart.getUTCMonth() + 1).padStart(2, "0");
        const d = String(weekStart.getUTCDate()).padStart(2, "0");

        return `${year}-${month}-${d}`;
    }

    /**
     * Query trend data for a specific period
     * @param {number} accountId - Account ID
     * @param {string} period - 'daily', 'weekly', 'monthly', 'yearly'
     * @param {string} fromDate - Start date (YYYY-MM-DD for daily/weekly, YYYY-MM for monthly, YYYY for yearly)
     * @param {string} toDate - End date
     * @returns {Object[]} Array of { date/week_start/year_month/year, total_debits, total_credits, net, txn_count }
     */
    getTrendData(
        accountId,
        period = "monthly",
        fromDate = null,
        toDate = null,
    ) {
        let query;
        let params = [accountId];

        switch (period.toLowerCase()) {
            case "daily":
                query = `SELECT date as period, total_debits, total_credits, net, txn_count 
                        FROM transaction_summaries 
                        WHERE account_id = ?`;
                if (fromDate) {
                    query += ` AND date >= ?`;
                    params.push(fromDate);
                }
                if (toDate) {
                    query += ` AND date <= ?`;
                    params.push(toDate);
                }
                query += ` ORDER BY date ASC`;
                break;

            case "weekly":
                query = `SELECT week_start_date as period, total_debits, total_credits, net, txn_count 
                        FROM transaction_summaries_weekly 
                        WHERE account_id = ?`;
                if (fromDate) {
                    query += ` AND week_start_date >= ?`;
                    params.push(fromDate);
                }
                if (toDate) {
                    query += ` AND week_start_date <= ?`;
                    params.push(toDate);
                }
                query += ` ORDER BY week_start_date ASC`;
                break;

            case "monthly":
                query = `SELECT year_month as period, total_debits, total_credits, net, txn_count 
                        FROM transaction_summaries_monthly 
                        WHERE account_id = ?`;
                if (fromDate) {
                    query += ` AND year_month >= ?`;
                    params.push(fromDate);
                }
                if (toDate) {
                    query += ` AND year_month <= ?`;
                    params.push(toDate);
                }
                query += ` ORDER BY year_month ASC`;
                break;

            case "yearly":
                query = `SELECT year as period, total_debits, total_credits, net, txn_count 
                        FROM transaction_summaries_yearly 
                        WHERE account_id = ?`;
                if (fromDate) {
                    const year = parseInt(fromDate, 10);
                    query += ` AND year >= ?`;
                    params.push(year);
                }
                if (toDate) {
                    const year = parseInt(toDate, 10);
                    query += ` AND year <= ?`;
                    params.push(year);
                }
                query += ` ORDER BY year ASC`;
                break;

            default:
                throw new Error(`Invalid period: ${period}`);
        }

        return this.db.prepare(query).all(...params);
    }

    /**
     * Clear all summaries for an account (use when re-importing)
     * @param {number} accountId - Account ID
     * @returns {Object} Count of cleared records
     */
    clearSummaries(accountId) {
        const daily = this.db
            .prepare(`DELETE FROM transaction_summaries WHERE account_id = ?`)
            .run(accountId).changes;
        const weekly = this.db
            .prepare(
                `DELETE FROM transaction_summaries_weekly WHERE account_id = ?`,
            )
            .run(accountId).changes;
        const monthly = this.db
            .prepare(
                `DELETE FROM transaction_summaries_monthly WHERE account_id = ?`,
            )
            .run(accountId).changes;
        const yearly = this.db
            .prepare(
                `DELETE FROM transaction_summaries_yearly WHERE account_id = ?`,
            )
            .run(accountId).changes;

        return { daily, weekly, monthly, yearly };
    }
}

module.exports = TransactionAggregator;
