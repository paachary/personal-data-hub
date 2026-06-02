"use client";

import styles from "./settings.module.css";
import LocationDropdown from "@/components/common/LocationDropdown";

export default function AddressInfoPanel({
    profile,
    setProfile,
    countriesData,
    stateOptions,
    cityOptions,
    loadingCountries,
    loadingCities,
    locationFallback,
    handleCountryChange,
    handleStateChange,
}) {
    const set = (field) => (e) =>
        setProfile((p) => ({ ...p, [field]: e.target.value }));

    return (
        <>
            <div className={styles.field}>
                <label className={styles.label}>Street Address</label>
                <input
                    className={styles.input}
                    value={profile.addressLine1}
                    onChange={set("addressLine1")}
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
                    onChange={set("addressLine2")}
                    placeholder="Apt 4B"
                />
            </div>
            <div className={styles.row}>
                {locationFallback ? (
                    <div className={styles.field}>
                        <label className={styles.label}>Country</label>
                        <input
                            className={styles.input}
                            value={profile.country}
                            onChange={set("country")}
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
                        options={countriesData.map((c) => c.name)}
                        loading={loadingCountries}
                        placeholder="— Select Country —"
                    />
                )}
                {locationFallback ? (
                    <div className={styles.field}>
                        <label className={styles.label}>State / Province</label>
                        <input
                            className={styles.input}
                            value={profile.state}
                            onChange={set("state")}
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
                        <label className={styles.label}>City</label>
                        <input
                            className={styles.input}
                            value={profile.city}
                            onChange={set("city")}
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
                    <label className={styles.label}>ZIP Code</label>
                    <input
                        className={styles.input}
                        value={profile.zip}
                        onChange={set("zip")}
                        placeholder="EC1A 1BB"
                    />
                </div>
            </div>
        </>
    );
}
