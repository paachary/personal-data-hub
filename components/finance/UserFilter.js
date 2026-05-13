"use client";

import fStyles from "./filter.module.css";

export default function UserFilter({ data, selectedUsers, onChange }) {
    // Build unique user options from any data array that has username/first_name/last_name
    const userOptions = [
        ...new Map(
            data.map((item) => [
                item.username,
                {
                    username: item.username,
                    name: `${item.first_name} ${item.last_name}`,
                },
            ])
        ).values(),
    ];

    if (userOptions.length === 0) return null;

    const toggle = (username) => {
        onChange(
            selectedUsers.includes(username)
                ? selectedUsers.filter((u) => u !== username)
                : [...selectedUsers, username]
        );
    };

    return (
        <div className={fStyles.filterBar}>
            <span className={fStyles.filterLabel}>Filter by user:</span>
            <div className={fStyles.chips}>
                {userOptions.map(({ username, name }) => (
                    <button
                        key={username}
                        className={`${fStyles.chip} ${
                            selectedUsers.includes(username)
                                ? fStyles.chipActive
                                : ""
                        }`}
                        onClick={() => toggle(username)}
                    >
                        {name}{" "}
                        <span className={fStyles.chipUser}>@{username}</span>
                    </button>
                ))}
                {selectedUsers.length > 0 && (
                    <button
                        className={fStyles.chipClear}
                        onClick={() => onChange([])}
                    >
                        ✕ Clear
                    </button>
                )}
            </div>
        </div>
    );
}
