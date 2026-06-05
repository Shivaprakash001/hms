import * as XLSX from "xlsx";

const csvData = `"Name","Joining Date"\n"Rahul Sharma","2026-07-01"\n"Priya","1/7/2026"\n"Arjun","45108"`;
const workbook = XLSX.read(csvData, { type: "string" });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

const jsonDataRawFalseCellDates = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: "yyyy-mm-dd" });

console.log("raw: false, no dateNF =>", XLSX.utils.sheet_to_json(worksheet, { raw: false }));
console.log("raw: false, dateNF: yyyy-mm-dd =>", jsonDataRawFalseCellDates);

const rawTrueCellDates = XLSX.utils.sheet_to_json(worksheet, { raw: true, cellDates: true });
console.log("raw: true, cellDates: true =>", rawTrueCellDates);
