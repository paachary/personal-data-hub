-- Add admin flag to users table
ALTER TABLE users ADD is_admin INTEGER DEFAULT 0;
-- SQLite does not support adding a column with a default value directly.
-- Instead, you need to create a new table, copy the data, and rename the table.

-- Step 1: Create a new table with the desired structure
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0
);

-- Step 2: Copy data from the old table to the new table
INSERT INTO users_new (id, username, email, password, is_admin)
SELECT id, username, email, password, 0 FROM users;

-- Step 3: Drop the old table
DROP TABLE users;

-- Step 4: Rename the new table to the original table name
ALTER TABLE users_new RENAME TO users;
-- Create Bank Master table
CREATE TABLE IF NOT EXISTS bank_master (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_name TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    city TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bank_name, branch_name, city)
);

-- Create Investment Types Master table
CREATE TABLE IF NOT EXISTS investment_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default investment types
INSERT INTO investment_types (code, description) VALUES
    ('LUMPSUM', 'Lumpsum Investment'),
    ('SIP', 'Systematic Investment Plan'),
    ('STP', 'Systematic Transfer Plan'),
    ('SWP', 'Systematic Withdrawal Plan');

-- Create User Bank Accounts table
CREATE TABLE IF NOT EXISTS user_bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    bank_master_id INTEGER NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('Savings', 'Current', 'NRE', 'NRO')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bank_master_id) REFERENCES bank_master(id),
    UNIQUE(user_id, account_number)
);

-- Add investment_type_id to investments table
ALTER TABLE investments ADD COLUMN investment_type_id INTEGER REFERENCES investment_types(id);

-- Add receipt uniqueness constraint (receipt is unique per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_investments_user_receipt ON investments(user_id, investment_ref_id) WHERE investment_ref_id IS NOT NULL;
