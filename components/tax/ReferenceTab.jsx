"use client";

import styles from "../finance/finance.module.css";
import taxStyles from "./tax.module.css";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function money(value) {
    return typeof value === "number" ? `₹${inr.format(value)}` : "—";
}

function percent(fraction) {
    return typeof fraction === "number" ? `${Math.round(fraction * 10000) / 100}%` : "—";
}

function slabGroups(slabs) {
    if (!slabs) return [];
    if (Array.isArray(slabs)) return [["All ages", slabs]];
    return Object.entries(slabs);
}

function SlabTable({ slabs }) {
    return (
        <div className={styles.tableWrapper}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Income from</th>
                        <th>Income to</th>
                        <th className={taxStyles.numeric}>Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {slabs.map((s) => (
                        <tr key={`${s.from}-${s.to}`}>
                            <td>{money(s.from)}</td>
                            <td>{s.to == null ? "and above" : money(s.to)}</td>
                            <td className={taxStyles.numeric}>{percent(s.rate?.value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div className={taxStyles.subsection}>
            <h3 className={taxStyles.subsectionTitle}>{title}</h3>
            {children}
        </div>
    );
}

export default function ReferenceTab({ rules }) {
    if (!rules) {
        return <div className={taxStyles.empty}><p>No reference rules are available for this year.</p></div>;
    }

    const { regimes, surcharge, cess, capitalGains, advanceTax, interest234B, interest234C, presumptive44AD } = rules;
    const period = capitalGains?.periods?.[capitalGains.periods.length - 1];
    const newRegime = regimes?.new;
    const oldRegime = regimes?.old;

    return (
        <div>
            <Section title="Income-tax slabs (new regime)">
                <SlabTable slabs={slabGroups(newRegime?.slabs)[0]?.[1] ?? []} />
                <p className={taxStyles.assumptions}>
                    Standard deduction {money(newRegime?.standardDeduction?.value)}. Section 87A rebate up to{" "}
                    {money(newRegime?.rebate87A?.maxAmount?.value)} when taxable income is up to{" "}
                    {money(newRegime?.rebate87A?.incomeLimit?.value)}.
                </p>
            </Section>

            {oldRegime && (
                <Section title="Income-tax slabs (old regime)">
                    {slabGroups(oldRegime.slabs).map(([group, slabs]) => (
                        <div key={group}>
                            <p className={styles.label}>{group}</p>
                            <SlabTable slabs={slabs} />
                        </div>
                    ))}
                    <p className={taxStyles.assumptions}>
                        Standard deduction {money(oldRegime.standardDeduction?.value)}. Section 87A rebate up to{" "}
                        {money(oldRegime.rebate87A?.maxAmount?.value)} when taxable income is up to{" "}
                        {money(oldRegime.rebate87A?.incomeLimit?.value)}.
                    </p>
                </Section>
            )}

            <Section title="Surcharge and cess">
                <p>
                    Health and education cess {percent(cess?.value)} on tax plus surcharge. Surcharge on capital gains
                    and dividends is capped at {percent(surcharge?.capitalGainsAndDividendsCap?.value)}.
                    {surcharge?.marginalRelief ? " Marginal relief applies." : ""}
                </p>
            </Section>

            {period && (
                <Section title="Capital gains">
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Gain type</th>
                                    <th className={taxStyles.numeric}>Rate</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Short-term, listed equity (111A)</td>
                                    <td className={taxStyles.numeric}>{percent(period.stcg111A?.value)}</td>
                                    <td>Special rate</td>
                                </tr>
                                <tr>
                                    <td>Long-term, listed equity (112A)</td>
                                    <td className={taxStyles.numeric}>{percent(period.ltcg112A?.value)}</td>
                                    <td>Exemption {money(period.ltcg112AExemption?.value)} per year</td>
                                </tr>
                                <tr>
                                    <td>Long-term, other (112)</td>
                                    <td className={taxStyles.numeric}>{percent(period.ltcgOther?.value)}</td>
                                    <td>No indexation</td>
                                </tr>
                                <tr>
                                    <td>Short-term, other</td>
                                    <td className={taxStyles.numeric}>Slab rate</td>
                                    <td>Added to taxable income</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </Section>
            )}

            <Section title="Advance tax instalments">
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Due date</th>
                                <th className={taxStyles.numeric}>Cumulative %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {advanceTax?.instalments?.map((i) => (
                                <tr key={i.dueOn}>
                                    <td>{i.dueOn}</td>
                                    <td className={taxStyles.numeric}>{i.cumulativePct?.value}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className={taxStyles.assumptions}>
                    Advance tax is due when the year&apos;s liability exceeds {money(advanceTax?.threshold?.value)}.
                </p>
            </Section>

            <Section title="Interest and presumptive income">
                <ul className={taxStyles.assumptions}>
                    <li>
                        Section 234B: {percent(interest234B?.monthlyRate?.value)} per month if advance tax is below{" "}
                        {interest234B?.minAdvanceTaxPct?.value}% of liability.
                    </li>
                    <li>
                        Section 234C: {percent(interest234C?.monthlyRate?.value)} per month for{" "}
                        {interest234C?.months?.value} months on instalment shortfalls.
                    </li>
                    <li>
                        Section 44AD: deemed profit {percent(presumptive44AD?.deemedRate?.value)} of turnover (digital
                        receipts {percent(presumptive44AD?.digitalReceiptsRate?.value)}). Turnover limit{" "}
                        {money(presumptive44AD?.turnoverLimit?.value)}, or {money(presumptive44AD?.turnoverLimitWithCashCap?.value)}
                        {" "}with cash receipts capped at {presumptive44AD?.cashReceiptsCapPct?.value}%.
                    </li>
                </ul>
            </Section>
        </div>
    );
}
