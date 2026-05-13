import React, { useState } from "react";

export const InvestmentTypesList = ({
    types,
    isAdmin,
    onAdd,
    onEdit,
    onDelete,
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ code: "", description: "" });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingId) {
            onEdit(editingId, formData);
            setEditingId(null);
        } else {
            onAdd(formData);
            setIsAdding(false);
        }
        setFormData({ code: "", description: "" });
    };

    const handleEdit = (type) => {
        setEditingId(type.id);
        setFormData({ code: type.code, description: type.description });
        setIsAdding(false);
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingId(null);
        setFormData({ code: "", description: "" });
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Investment Types</h2>
                {isAdmin && !isAdding && !editingId && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="btn-primary"
                    >
                        Add Type
                    </button>
                )}
            </div>

            {(isAdding || editingId) && (
                <form
                    onSubmit={handleSubmit}
                    className="mb-6 p-4 border rounded"
                >
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <input
                            type="text"
                            placeholder="Code (e.g., SIP)"
                            value={formData.code}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    code: e.target.value.toUpperCase(),
                                })
                            }
                            required
                            className="input"
                        />
                        <input
                            type="text"
                            placeholder="Description"
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    description: e.target.value,
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
                        <th className="border p-2 text-left">Code</th>
                        <th className="border p-2 text-left">Description</th>
                        {isAdmin && (
                            <th className="border p-2 text-left">Actions</th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {types.map((type) => (
                        <tr key={type.id}>
                            <td className="border p-2">{type.code}</td>
                            <td className="border p-2">{type.description}</td>
                            {isAdmin && (
                                <td className="border p-2">
                                    <button
                                        onClick={() => handleEdit(type)}
                                        className="text-blue-600 mr-2"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => onDelete(type.id)}
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
