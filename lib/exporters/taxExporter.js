const XLSX = require("xlsx");
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, HeadingLevel } = require("docx");

function sheetFromRows(headers, rows) {
    return XLSX.utils.aoa_to_sheet([headers, ...rows]);
}

function instalmentRows(overview) {
    const instalments = overview.schedule?.instalments ?? [];
    return instalments.map((i) => [
        i.dueDate,
        i.cumulativePct,
        i.required,
        i.paid,
        i.shortfall,
        i.interest234C?.amount ?? 0,
    ]);
}

function summaryRows(overview) {
    const chosen = overview.tax?.regimes?.[overview.recommendedRegime];
    const schedule = overview.schedule ?? {};
    return [
        ["Financial year", overview.fy ?? ""],
        ["Recommended regime", overview.recommendedRegime ?? ""],
        ["Net tax (recommended regime)", overview.netTax ?? chosen?.totalTax ?? 0],
        ["Advance tax applicable", schedule.applicable ? "Yes" : "No"],
        ["Advance tax payable", schedule.advanceTaxPayable ?? 0],
        ["Interest u/s 234B", schedule.interest234B?.amount ?? 0],
        ["Interest u/s 234C", schedule.totals?.interest234C ?? 0],
    ];
}

/**
 * Builds the Excel workbook for one financial year's tax overview.
 * @param {Object} overview - Result of lib/tax/service getOverview, with `fy` added by the caller.
 * @returns {Object} XLSX workbook
 */
function buildTaxWorkbook(overview) {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        wb,
        sheetFromRows(["Item", "Value"], summaryRows(overview)),
        "Overview"
    );
    XLSX.utils.book_append_sheet(
        wb,
        sheetFromRows(
            ["Due date", "Cumulative %", "Required", "Paid", "Shortfall", "Interest 234C"],
            instalmentRows(overview)
        ),
        "Instalments"
    );
    XLSX.utils.book_append_sheet(
        wb,
        sheetFromRows(
            ["Source", "Interest / amount"],
            Object.entries(overview.incomeTotals ?? {}).map(([k, v]) => [k, v])
        ),
        "Income"
    );
    XLSX.utils.book_append_sheet(
        wb,
        sheetFromRows(
            ["Sale date", "Asset class", "Category", "Description", "Gain", "Needs review"],
            (overview.capitalGains ?? []).map((g) => [
                g.sale_date,
                g.asset_class,
                g.category,
                g.description ?? "",
                g.gain,
                g.needs_review ? "Yes" : "No",
            ])
        ),
        "Capital Gains"
    );
    XLSX.utils.book_append_sheet(
        wb,
        sheetFromRows(
            ["Paid on", "Amount", "Kind", "Reference"],
            (overview.payments ?? []).map((p) => [p.paid_on, p.amount, p.kind ?? "", p.reference ?? ""])
        ),
        "Payments"
    );

    return wb;
}

function cell(text, bold = false) {
    return new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ""), bold })] })],
    });
}

function table(headers, rows) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({ children: headers.map((h) => cell(h, true)) }),
            ...rows.map((r) => new TableRow({ children: r.map((v) => cell(v)) })),
        ],
    });
}

/**
 * Builds a Word summary document for one financial year's tax overview.
 * @param {Object} overview - Result of lib/tax/service getOverview, with `fy` added by the caller.
 * @returns {Promise<Buffer>} .docx file contents
 */
function buildTaxSummaryDocx(overview) {
    const doc = new Document({
        sections: [
            {
                children: [
                    new Paragraph({ text: `Advance Tax Summary, FY ${overview.fy ?? ""}`, heading: HeadingLevel.HEADING_1 }),
                    new Paragraph({ text: "Overview", heading: HeadingLevel.HEADING_2 }),
                    table(["Item", "Value"], summaryRows(overview)),
                    new Paragraph({ text: "Instalments", heading: HeadingLevel.HEADING_2 }),
                    table(
                        ["Due date", "Cumulative %", "Required", "Paid", "Shortfall", "Interest 234C"],
                        instalmentRows(overview)
                    ),
                    new Paragraph({ text: "Notes", heading: HeadingLevel.HEADING_2 }),
                    ...(overview.notes ?? []).map((n) => new Paragraph({ text: `• ${n}` })),
                ],
            },
        ],
    });
    return Packer.toBuffer(doc);
}

module.exports = { buildTaxWorkbook, buildTaxSummaryDocx };
