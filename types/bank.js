/**
 * @typedef {Object} BankMaster
 * @property {number} id
 * @property {string} bank_name
 * @property {string} branch_name
 * @property {string} city
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} UserBankAccount
 * @property {number} id
 * @property {number} user_id
 * @property {number} bank_master_id
 * @property {string} account_number
 * @property {"Savings"|"Current"|"NRE"|"NRO"} account_type
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string} [bank_name]
 * @property {string} [branch_name]
 * @property {string} [city]
 */

/**
 * @typedef {Object} InvestmentType
 * @property {number} id
 * @property {string} code
 * @property {string} description
 * @property {string} created_at
 * @property {string} updated_at
 */

export const ACCOUNT_TYPES = ["Savings", "Current", "NRE", "NRO"];
