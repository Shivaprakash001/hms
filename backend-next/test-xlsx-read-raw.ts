import * as XLSX from "xlsx";

const csvData = `"Name","Joining Date"\n"Rahul Sharma","2026-07-01"\n"Priya","01/07/2026"\n"Arjun","45108"`;
const workbook = XLSX.read(csvData, { type: "string", raw: true });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

const jsonDataRawTrue = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: "" });

console.log("XLSX.read(..., { raw: true }) =>");
console.dir(jsonDataRawTrue, { depth: null });
