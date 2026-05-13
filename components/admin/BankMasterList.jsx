import React, { useState } from "react";

export const BankMasterList = ({ banks, isAdmin, onAdd, onEdit, onDelete }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        bank_name: "",
        branch_name: "",
        city: "",
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingId) {
            onEdit(editingId, formData);
            setEditingId(null);
        } else {
            onAdd(formData);
            setIsAdding(false);
        }
        setFormData({ bank_name: "", branch_name: "", city: "" });
    };

    const handleEdit = (bank) => {
        setEditingId(bank.id);
        setFormData({
            bank_name: bank.bank_name,
            branch_name: bank.branch_name,
            city: bank.city,
        });
        setIsAdding(false);
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingId(null);
        setFormData({ bank_name: "", branch_name: "", city: "" });
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Bank Master</h2>
                {isAdmin && !isAdding && !editingId && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="btn-primary"
                    >
                        Add Bank
                    </button>
                )}
            </div>

            {(isAdding || editingId) && (
                <form
                    onSubmit={handleSubmit}
                    className="mb-6 p-4 border rounded"
                >
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <input
                            type="text"
                            placeholder="Bank Name"
                            value={formData.bank_name}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    bank_name: e.target.value,
                                })
                            }
                            required
                            className="input"
                        />
                        <input
                            type="text"
                            placeholder="Branch Name"
                            value={formData.branch_name}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    branch_name: e.target.value,
                                })
                            }
                            required
                            className="input"
                        />
                        <input
                            type="text"
                            placeholder="City"
                            value={formData.city}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    city: e.target.value,
                                })
                            }
                            required
                            className="input"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="btn-primary">
                            {editingId ? "Update" : "Add"}
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
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
                        <th className="border p-2 text-left">Bank Name</th>
                        <th className="border p-2 text-left">Branch Name</th>
                        <th className="border p-2 text-left">City</th>
                        {isAdmin && (
                            <th className="border p-2 text-left">Actions</th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {banks.map((bank) => (
                        <tr key={bank.id}>
                            <td className="border p-2">
                                {bank.bank_name ?? bank.bankName ?? bank.name}
                            </td>
                            <td className="border p-2">
                                {bank.branch_name ??
                                    bank.branchName ??
                                    bank.branch}
                            </td>
                            <td className="border p-2">{bank.city}</td>
                            {isAdmin && (
                                <td className="border p-2">
                                    <button
                                        onClick={() => handleEdit(bank)}
                                        className="text-blue-600 mr-2"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => onDelete(bank.id)}
                                        className="text-red-600"
                                    >
                                        Delete
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
