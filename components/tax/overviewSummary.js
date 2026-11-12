import { formatAmount } from "./format";

export const REGIME_LABELS = { old: "Old regime", new: "New regime" };

export const REGIME_ROWS = [
    ["Gross total income", (r) => r.grossTotalIncome?.total],
    ["Deductions", (r) => r.deductions?.total],
    ["Taxable income", (r) => r.taxableIncome?.total],
    ["Tax on slabs", (r) => r.slabTax],
    ["Rebate u/s 87A", (r) => r.rebate87A?.rebate],
    ["Special-rate tax (capital gains)", (r) => r.specialTax?.total],
    ["Surcharge", (r) => r.surcharge],
    ["Health & education cess", (r) => r.cess?.amount],
    ["Total tax", (r) => r.totalTax],
];

export function isEmptyOverview(data) {
    const hasIncome = Object.values(data.incomeTotals).some((v) => typeof v === "number" && v > 0);
    return !data.profileSaved && !hasIncome && data.payments.length === 0 && data.capitalGains.length === 0;
}

// Income that is pulled in automatically (interest, dividends). Capital gains are taxed at special rates and are excluded.
export function autoOtherIncome(incomeTotals) {
    const { interestSavings = 0, interestDeposits = 0, interestOther = 0, dividends = 0 } = incomeTotals;
    return interestSavings + interestDeposits + interestOther + dividends;
}

export function summarizeOverview(data) {
    if (!data) return null;
    const { tax, schedule, recommendedRegime } = data;
    const regimeKeys = Object.keys(tax.regimes);
    const chosen = tax.regimes[recommendedRegime] ?? null;
    return {
        regimeKeys,
        recommended: recommendedRegime,
        recommendedLabel: REGIME_LABELS[recommendedRegime] ?? "—",
        saving: regimeKeys.length > 1 ? tax.saving : null,
        totalTax: data.netTax,
        tdsTcs: chosen?.tdsTcs,
        payable: Math.max(0, schedule.advanceTaxPayable ?? 0),
        payableText: formatAmount(Math.max(0, schedule.advanceTaxPayable ?? 0)),
        totalTaxText: formatAmount(data.netTax),
        savingText: regimeKeys.length > 1 ? formatAmount(tax.saving) : null,
    };
}
