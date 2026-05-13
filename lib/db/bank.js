import Database from "better-sqlite3";

export class BankRepository {
    constructor(db) {
        this.db = db;
    }

    // Bank Master operations
    getAllBanks() {
        return this.db
            .prepare(
                "SELECT * FROM bank_master ORDER BY bank_name, branch_name"
            )
            .all();
    }

    getBankById(id) {
        return this.db
            .prepare("SELECT * FROM bank_master WHERE id = ?")
            .get(id);
    }

    createBank(bank) {
        const result = this.db
            .prepare(
                "INSERT INTO bank_master (bank_name, branch_name, city) VALUES (?, ?, ?)"
            )
            .run(bank.bank_name, bank.branch_name, bank.city);
        return this.getBankById(result.lastInsertRowid);
    }

    updateBank(id, bank) {
        this.db
            .prepare(
                "UPDATE bank_master SET bank_name = ?, branch_name = ?, city = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            )
            .run(bank.bank_name, bank.branch_name, bank.city, id);
    }

    deleteBank(id) {
        this.db.prepare("DELETE FROM bank_master WHERE id = ?").run(id);
    }

    // User Bank Accounts operations
    getUserBankAccounts(userId) {
        return this.db
            .prepare(
                `
      SELECT uba.*, bm.bank_name, bm.branch_name, bm.city
      FROM user_bank_accounts uba
      JOIN bank_master bm ON uba.bank_master_id = bm.id
      WHERE uba.user_id = ?
      ORDER BY bm.bank_name, uba.account_number
    `
            )
            .all(userId);
    }

    createUserBankAccount(account) {
        const result = this.db
            .prepare(
                "INSERT INTO user_bank_accounts (user_id, bank_master_id, account_number, account_type) VALUES (?, ?, ?, ?)"
            )
            .run(
                account.user_id,
                account.bank_master_id,
                account.account_number,
                account.account_type
            );
        return this.db
            .prepare(
                `
      SELECT uba.*, bm.bank_name, bm.branch_name, bm.city
      FROM user_bank_accounts uba
      JOIN bank_master bm ON uba.bank_master_id = bm.id
      WHERE uba.id = ?
    `
            )
            .get(result.lastInsertRowid);
    }

    deleteUserBankAccount(id, userId) {
        this.db
            .prepare(
                "DELETE FROM user_bank_accounts WHERE id = ? AND user_id = ?"
            )
            .run(id, userId);
    }

    // Investment Types operations
    getAllInvestmentTypes() {
        return this.db
            .prepare("SELECT * FROM investment_types ORDER BY code")
            .all();
    }

    getInvestmentTypeById(id) {
        return this.db
            .prepare("SELECT * FROM investment_types WHERE id = ?")
            .get(id);
    }

    createInvestmentType(type) {
        const result = this.db
            .prepare(
                "INSERT INTO investment_types (code, description) VALUES (?, ?)"
            )
            .run(type.code, type.description);
        return this.getInvestmentTypeById(result.lastInsertRowid);
    }

    updateInvestmentType(id, type) {
        this.db
            .prepare(
                "UPDATE investment_types SET code = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            )
            .run(type.code, type.description, id);
    }

    deleteInvestmentType(id) {
        this.db.prepare("DELETE FROM investment_types WHERE id = ?").run(id);
    }
}
