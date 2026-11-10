"use strict";

const { readRawRows } = require("./common");

/**
 * AIS (Annual Information Statement) files have no published, stable layout, so no column mapping is
 * guessed here. The file is read to confirm it is a spreadsheet or CSV, then the import is refused with
 * a clear message. Add a layout parser here once an anonymised sample has been verified.
 */
function parseAis(buffer, ext) {
    readRawRows(buffer, ext);
    throw new Error(
        "This AIS layout is not supported yet. Enter the figures with the income template instead, " +
        "or send an anonymised sample so a parser can be added.",
    );
}

module.exports = { parseAis };
