"use client";

import styles from "./taxPage.module.css";
import { formatAmount } from "./format";

export default function SlabTable({ slabs, totalTaxable, totalTax, showAll }) {
    // The marginal slab is the highest slab that has taxable income. Slab numbers keep their position in the full schedule.
    let marginalIndex = -1;
    slabs.forEach((s, index) => {
        if (s.taxableInSlab > 0) marginalIndex = index;
    });

    const rows = slabs.map((s, index) => ({ s, index })).filter(({ s }) => showAll || s.taxableInSlab > 0);

    return (
        <div className={styles.tableWrap}>
            <table className={styles.table}>
                <thead>
                    <tr>
                        <th scope="col">Slab</th>
                        <th scope="col" className={styles.num}>From</th>
                        <th scope="col" className={styles.num}>Up to</th>
                        <th scope="col" className={styles.num}>Rate</th>
                        <th scope="col" className={styles.num}>Taxable in slab</th>
                        <th scope="col" className={styles.num}>Tax</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ s, index }) => {
                        const dim = s.taxableInSlab > 0 ? "" : styles.dim;
                        return (
                            <tr key={s.from} className={index === marginalIndex ? styles.marginal : undefined}>
                                <td className={dim}>{index + 1}</td>
                                <td className={`${styles.num} ${dim}`}>{formatAmount(s.from)}</td>
                                <td className={`${styles.num} ${dim}`}>{s.to === null ? "Above" : formatAmount(s.to)}</td>
                                <td className={`${styles.num} ${dim}`}>{Math.round(s.rate * 100)}%</td>
                                <td className={`${styles.num} ${dim}`}>{formatAmount(s.taxableInSlab)}</td>
                                <td className={`${styles.num} ${dim}`}>{formatAmount(s.taxInSlab)}</td>
                            </tr>
                        );
                    })}
                    <tr className={styles.totalRow}>
                        <td>Total</td>
                        <td />
                        <td />
                        <td />
                        <td className={styles.num}>{formatAmount(totalTaxable)}</td>
                        <td className={styles.num}>{formatAmount(totalTax)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
