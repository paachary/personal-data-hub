import React, { useState } from "react";

const ACCOUNT_TYPES = ["Savings", "Current", "NRE", "NRO"];

export const UserBankAccountsList = ({
    accounts,
    banks,
    onAdd,
    onDelete,
    userId,
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [formData, setFormData] = useState({
        bank_master_id: "",
        account_number: "",
        account_type: "Savings",
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onAdd({
            user_id: userId,
            bank_master_id: parseInt(formData.bank_master_id),
            account_number: formData.account_number,
            account_type: formData.account_type,
        });
        setIsAdding(false);
        setFormData({
            bank_master_id: "",
            account_number: "",
            account_type: "Savings",
        });
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">My Bank Accounts</h2>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="btn-primary"
                    >
                        Add Account
                    </button>
                )}
            </div>

            {isAdding && (
                <form
                    onSubmit={handleSubmit}
                    className="mb-6 p-4 border rounded"
                >
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <select
                            value={formData.bank_master_id}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    bank_master_id: e.target.value,
                                })
                            }
                            required
                            className="input"
                        >
                            <option value="">Select Bank</option>
                            {banks.map((bank) => (
                                <option key={bank.id} value={bank.id}>
                                    {bank.bank_name} - {bank.branch_name},{" "}
                                    {bank.city}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Account Number"
                            value={formData.account_number}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    account_number: e.target.value,
                                })
                            }
                            required
                            className="input"
                        />
                        <select
                            value={formData.account_type}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    account_type: e.target.value,
                                })
                            }
                            required
                            className="input"
                        >
                            {ACCOUNT_TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="btn-primary">
                            Add
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border p-2 text-left">Bank</th>
                        <th className="border p-2 text-left">Branch</th>
                        <th className="border p-2 text-left">City</th>
                        <th className="border p-2 text-left">Account Number</th>
                        <th className="border p-2 text-left">Type</th>
                        <th className="border p-2 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {accounts.map((account) => (
                        <tr key={account.id}>
                            <td className="border p-2">{account.bank_name}</td>
                            <td className="border p-2">
                                {account.branch_name}
                            </td>
                            <td className="border p-2">{account.city}</td>
                            <td className="border p-2">
                                {account.account_number}
                            </td>
                            <td className="border p-2">
                                {account.account_type}
                            </td>
                            <td className="border p-2">
                                <button
                                    onClick={() => onDelete(account.id)}
                                    className="text-red-600"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
