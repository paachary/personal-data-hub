"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./settings.module.css";
import LocationDropdown from "@/components/common/LocationDropdown";

const COUNTRIES_STATES_URL =
    "https://countriesnow.space/api/v0.1/countries/states";
const CITIES_URL = "https://countriesnow.space/api/v0.1/countries/state/cities";

export default function SettingsGeneral() {
    const [profile, setProfile] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        zip: "",
        country: "",
    });

    // ── Location cascade state ──
    const [countriesData, setCountriesData] = useState([]);
    const [stateOptions, setStateOptions] = useState([]);
    const [cityOptions, setCityOptions] = useState([]);
    const [loadingCountries, setLoadingCountries] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [locationFallback, setLocationFallback] = useState(false);
    const [passwords, setPasswords] = useState({
        current: "",
        newPass: "",
        confirm: "",
    });

    const [profileError, setProfileError] = useState("");
    const [profileSuccess, setProfileSuccess] = useState("");
    const [passError, setPassError] = useState("");
    const [passSuccess, setPassSuccess] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPass, setSavingPass] = useState(false);

    // ── Navigation ──
    const [activeTab, setActiveTab] = useState("profile"); // "profile" | "password"
    const [activeProfileTab, setActiveProfileTab] = useState("personal"); // "personal" | "address"

    // Fetch countries + states once on mount
    useEffect(() => {
        let cancelled = false;
        setLoadingCountries(true);
        fetch(COUNTRIES_STATES_URL)
            .then((r) => {
                if (!r.ok) throw new Error("Failed to fetch countries");
                return r.json();
            })
            .then((json) => {
                if (!cancelled) setCountriesData(json.data ?? []);
            })
            .catch(() => {
                if (!cancelled) setLocationFallback(true);
            })
            .finally(() => {
                if (!cancelled) setLoadingCountries(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        async function load() {
            const session = await window.electronAPI.getSession();
            const user = await window.electronAPI.settings.getProfile(
                session.userId,
            );
            const savedCountry = user.country || "";
            const savedState = user.state || "";

            setProfile({
                firstName: user.first_name || "",
                lastName: user.last_name || "",
                email: user.email || "",
                phone: user.phone || "",
                addressLine1: user.address_line1 || "",
                addressLine2: user.address_line2 || "",
                city: user.city || "",
                state: savedState,
                zip: user.zip || "",
                country: savedCountry,
            });

            // Pre-populate states if country already saved
            if (savedCountry) {
                fetch(COUNTRIES_STATES_URL)
                    .then((r) => r.json())
                    .then((json) => {
                        const found = (json.data ?? []).find(
                            (c) => c.name === savedCountry,
                        );
                        setStateOptions(
                            found?.states?.map((s) => s.name) ?? [],
                        );
                    })
                    .catch(() => {});
            }

            // Pre-populate cities if state already saved
            if (savedCountry && savedState) {
                fetch(CITIES_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        country: savedCountry,
                        state: savedState,
                    }),
                })
                    .then((r) => r.json())
                    .then((json) => setCityOptions(json.data ?? []))
                    .catch(() => {});
            }
        }
        load();
    }, []);

    const handleCountryChange = useCallback(
        (e) => {
            const country = e.target.value;
            setProfile((p) => ({ ...p, country, state: "", city: "" }));
            setCityOptions([]);
            const found = countriesData.find((c) => c.name === country);
            setStateOptions(found?.states?.map((s) => s.name) ?? []);
        },
        [countriesData],
    );

    const handleStateChange = useCallback(
        async (e) => {
            const state = e.target.value;
            setProfile((p) => ({ ...p, state, city: "" }));
            setCityOptions([]);
            if (!state) return;
            setLoadingCities(true);
            try {
                const res = await fetch(CITIES_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        country: profile.country,
                        state,
                    }),
                });
                if (!res.ok) throw new Error();
                const json = await res.json();
                setCityOptions(json.data ?? []);
            } catch {
                setCityOptions([]);
            } finally {
                setLoadingCities(false);
            }
        },
        [profile.country],
    );

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setProfileError("");
        setProfileSuccess("");
        if (!profile.firstName.trim())
            return setProfileError("First name is required.");
        if (!profile.email.trim()) return setProfileError("Email is required.");
        setSavingProfile(true);
        try {
            await window.electronAPI.settings.updateProfile({
                firstName: profile.firstName.trim(),
                lastName: profile.lastName.trim(),
                email: profile.email.trim(),
                phone: profile.phone.trim(),
                addressLine1: profile.addressLine1.trim(),
                addressLine2: profile.addressLine2.trim(),
                city: profile.city.trim(),
                state: profile.state.trim(),
                zip: profile.zip.trim(),
                country: profile.country.trim(),
            });
            setProfileSuccess("Profile updated successfully.");
        } catch (err) {
            setProfileError(err.message);
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordSave = async (e) => {
        e.preventDefault();
        setPassError("");
        setPassSuccess("");
        if (!passwords.current)
            return setPassError("Current password is required.");
        if (!passwords.newPass)
            return setPassError("New password is required.");
        if (passwords.newPass.length < 8)
            return setPassError("New password must be at least 8 characters.");
        if (passwords.newPass !== passwords.confirm)
            return setPassError("Passwords do not match.");
        setSavingPass(true);
        try {
            const result = await window.electronAPI.settings.changePassword({
                currentPassword: passwords.current,
                newPassword: passwords.newPass,
            });
            if (!result.success) return setPassError(result.message);
            setPassSuccess("Password changed successfully.");
            setPasswords({ current: "", newPass: "", confirm: "" });
        } catch (err) {
            setPassError(err.message);
        } finally {
            setSavingPass(false);
        }
    };

    return (
        <div className={styles.settingsPage}>
            {/* ── Top-level tabs ── */}
            <div className={styles.tabs}>
                <button
                    type="button"
                    className={`${styles.tab} ${
                        activeTab === "profile" ? styles.tabActive : ""
                    }`}
                    onClick={() => setActiveTab("profile")}
                >
                    👤 Profile
                </button>
                <button
                    type="button"
                    className={`${styles.tab} ${
                        activeTab === "password" ? styles.tabActive : ""
                    }`}
                    onClick={() => setActiveTab("password")}
                >
                    🔒 Password
                </button>
            </div>

            {/* ── Profile Panel ── */}
            {activeTab === "profile" && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon}>👤</div>
                        <div>
                            <h2 className={styles.cardTitle}>Profile</h2>
                            <p className={styles.cardSubtitle}>
                                Update your personal and address information
                            </p>
                        </div>
                    </div>

                    {/* Sub-tabs */}
                    <div className={styles.subTabs}>
                        <button
                            type="button"
                            className={`${styles.subTab} ${
                                activeProfileTab === "personal"
                                    ? styles.subTabActive
                                    : ""
                            }`}
                            onClick={() => setActiveProfileTab("personal")}
                        >
                            Personal
                        </button>
                        <button
                            type="button"
                            className={`${styles.subTab} ${
                                activeProfileTab === "address"
                                    ? styles.subTabActive
                                    : ""
                            }`}
                            onClick={() => setActiveProfileTab("address")}
                        >
                            Address
                        </button>
                    </div>

                    <form onSubmit={handleProfileSave} className={styles.form}>
                        {/* ── Personal sub-tab ── */}
                        {activeProfileTab === "personal" && (
                            <>
                                <div className={styles.row}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>
                                            First Name{" "}
                                            <span className={styles.required}>
                                                *
                                            </span>
                                        </label>
                                        <input
                                            className={styles.input}
                                            value={profile.firstName}
                                            onChange={(e) =>
                                                setProfile((p) => ({
                                                    ...p,
                                                    firstName: e.target.value,
                                                }))
                                            }
                                            placeholder="John"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <label className={styles.label}>
                                            Last Name
                                        </label>
                                        <input
                                            className={styles.input}
                                            value={profile.lastName}
                                            onChange={(e) =>
                                                setProfile((p) => ({
                                                    ...p,
                                                    lastName: e.target.value,
                                                }))
                                            }
                                            placeholder="Doe"
                                        />
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>
                                        Email{" "}
                                        <span className={styles.required}>
                                            *
                                        </span>
                                    </label>
                                    <input
                                        className={styles.input}
                                        type="email"
                                        value={profile.email}
                                        onChange={(e) =>
                                            setProfile((p) => ({
                                                ...p,
                                                email: e.target.value,
                                            }))
                                        }
                                        placeholder="john@example.com"
                                    />
                                </div>
                                <div className={styles.row}>
                                    <div className={styles.field}>
                                        <label className={styles.label}>
                                            Mobile Number
                                        </label>
                                        <input
                                            className={styles.input}
                                            type="tel"
                                            value={profile.phone}
                                            onChange={(e) =>
                                                setProfile((p) => ({
                                                    ...p,
                                                    phone: e.target.value,
                                                }))
                                            }
                                            placeholder="+44 7700 900000"
                                        />
                                    </div>
                                    <div style={{ flex: 1 }} />
                                </div>
                            </>
                        )}

                        {/* ── Address sub-tab ── */}
                        {activeProfileTab === "address" && (
                            <>
                                <div className={styles.field}>
                                    <label className={styles.label}>
                                        Street Address
                                    </label>
                                    <input
                                        className={styles.input}
                                        value={profile.addressLine1}
                                        onChange={(e) =>
                                            setProfile((p) => ({
                                                ...p,
                                                addressLine1: e.target.value,
                                            }))
                                        }
                                        placeholder="123 Main St"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>
                                        Apartment / Suite (optional)
                                    </label>
                                    <input
                                        className={styles.input}
                                        value={profile.addressLine2}
                                        onChange={(e) =>
                                            setProfile((p) => ({
                                                ...p,
                                                addressLine2: e.target.value,
                                            }))
                                        }
                                        placeholder="Apt 4B"
                                    />
                                </div>
                                <div className={styles.row}>
                                    {locationFallback ? (
                                        <div className={styles.field}>
                                            <label className={styles.label}>
                                                Country
                                            </label>
                                            <input
                                                className={styles.input}
                                                value={profile.country}
                                                onChange={(e) =>
                                                    setProfile((p) => ({
                                                        ...p,
                                                        country: e.target.value,
                                                    }))
                                                }
                                                placeholder="Country"
                                            />
                                        </div>
                                    ) : (
                                        <LocationDropdown
                                            id="country"
                                            label="Country"
                                            name="country"
                                            value={profile.country}
                                            onChange={handleCountryChange}
                                            options={countriesData.map(
                                                (c) => c.name,
                                            )}
                                            loading={loadingCountries}
                                            placeholder="— Select Country —"
                                        />
                                    )}
                                    {locationFallback ? (
                                        <div className={styles.field}>
                                            <label className={styles.label}>
                                                State / Province
                                            </label>
                                            <input
                                                className={styles.input}
                                                value={profile.state}
                                                onChange={(e) =>
                                                    setProfile((p) => ({
                                                        ...p,
                                                        state: e.target.value,
                                                    }))
                                                }
                                                placeholder="State"
                                            />
                                        </div>
                                    ) : (
                                        <LocationDropdown
                                            id="state"
                                            label="State / Province"
                                            name="state"
                                            value={profile.state}
                                            onChange={handleStateChange}
                                            options={stateOptions}
                                            disabled={!profile.country}
                                            placeholder={
                                                profile.country
                                                    ? "— Select State —"
                                                    : "— Select Country first —"
                                            }
                                        />
                                    )}
                                </div>
                                <div className={styles.row}>
                                    {locationFallback ? (
                                        <div className={styles.field}>
                                            <label className={styles.label}>
                                                City
                                            </label>
                                            <input
                                                className={styles.input}
                                                value={profile.city}
                                                onChange={(e) =>
                                                    setProfile((p) => ({
                                                        ...p,
                                                        city: e.target.value,
                                                    }))
                                                }
                                                placeholder="City"
                                            />
                                        </div>
                                    ) : (
                                        <LocationDropdown
                                            id="city"
                                            label="City"
                                            name="city"
                                            value={profile.city}
                                            onChange={(e) =>
                                                setProfile((p) => ({
                                                    ...p,
                                                    city: e.target.value,
                                                }))
                                            }
                                            options={cityOptions}
                                            disabled={!profile.state}
                                            loading={loadingCities}
                                            placeholder={
                                                profile.state
                                                    ? "— Select City —"
                                                    : "— Select State first —"
                                            }
                                        />
                                    )}
                                    <div className={styles.field}>
                                        <label className={styles.label}>
                                            ZIP Code
                                        </label>
                                        <input
                                            className={styles.input}
                                            value={profile.zip}
                                            onChange={(e) =>
                                                setProfile((p) => ({
                                                    ...p,
                                                    zip: e.target.value,
                                                }))
                                            }
                                            placeholder="EC1A 1BB"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {profileError && (
                            <p className={styles.error}>{profileError}</p>
                        )}
                        {profileSuccess && (
                            <p className={styles.success}>{profileSuccess}</p>
                        )}

                        <div className={styles.actions}>
                            <button
                                type="submit"
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                disabled={savingProfile}
                            >
                                {savingProfile ? "Saving..." : "Save Profile"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Password Panel ── */}
            {activeTab === "password" && (
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardIcon}>🔒</div>
                        <div>
                            <h2 className={styles.cardTitle}>
                                Change Password
                            </h2>
                            <p className={styles.cardSubtitle}>
                                Keep your account secure
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handlePasswordSave} className={styles.form}>
                        <div className={styles.field}>
                            <label className={styles.label}>
                                Current Password{" "}
                                <span className={styles.required}>*</span>
                            </label>
                            <input
                                className={styles.input}
                                type="password"
                                value={passwords.current}
                                onChange={(e) =>
                                    setPasswords((p) => ({
                                        ...p,
                                        current: e.target.value,
                                    }))
                                }
                                placeholder="••••••••"
                            />
                        </div>
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label className={styles.label}>
                                    New Password{" "}
                                    <span className={styles.required}>*</span>
                                </label>
                                <input
                                    className={styles.input}
                                    type="password"
                                    value={passwords.newPass}
                                    onChange={(e) =>
                                        setPasswords((p) => ({
                                            ...p,
                                            newPass: e.target.value,
                                        }))
                                    }
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>
                                    Confirm New Password{" "}
                                    <span className={styles.required}>*</span>
                                </label>
                                <input
                                    className={styles.input}
                                    type="password"
                                    value={passwords.confirm}
                                    onChange={(e) =>
                                        setPasswords((p) => ({
                                            ...p,
                                            confirm: e.target.value,
                                        }))
                                    }
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {passError && (
                            <p className={styles.error}>{passError}</p>
                        )}
                        {passSuccess && (
                            <p className={styles.success}>{passSuccess}</p>
                        )}

                        <div className={styles.actions}>
                            <button
                                type="submit"
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                disabled={savingPass}
                            >
                                {savingPass ? "Changing..." : "Change Password"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
