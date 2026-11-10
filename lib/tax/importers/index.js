"use strict";

const { parseCams } = require("./cams");
const { parseIncomeTemplate } = require("./template");
const { parseAis } = require("./ais");
const { annotate, commitRows } = require("./persist");

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const EXTENSIONS = ["xlsx", "xls", "csv"];

const PARSERS = {
    cams: parseCams,
    incomeTemplate: parseIncomeTemplate,
    ais: parseAis,
};

/** Parses a file for the given import kind. Returns the raw parsed rows without DB access. */
function parseImportFile(kind, buffer, ext, fy) {
    const parser = PARSERS[kind];
    if (!parser) throw new TypeError("Unknown import kind.");
    if (!EXTENSIONS.includes(ext)) throw new Error("Use an .xlsx, .xls or .csv file.");
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error("The file is empty.");
    if (buffer.length > MAX_FILE_BYTES) throw new Error("The file is larger than 10 MB.");
    return kind === "cams" ? parser(buffer, ext, fy) : parser(buffer, ext);
}

/** Parses and annotates a file for preview. Does not write. */
function previewImport(db, userId, kind, buffer, ext, fy) {
    const rows = parseImportFile(kind, buffer, ext, fy);
    return annotate(db, userId, kind, rows);
}

module.exports = { previewImport, commitRows, parseImportFile, MAX_FILE_BYTES, EXTENSIONS };
