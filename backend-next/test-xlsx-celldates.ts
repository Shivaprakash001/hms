import * as XLSX from "xlsx";

const csvData = `"Name","Joining Date"\n"Rahul Sharma","2026-07-01"\n"Priya","1/7/2026"\n"Arjun","45108"`;
const workbook = XLSX.read(csvData, { type: "string", cellDates: true });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: "yyyy-mm-dd" });

console.log("Result:", jsonData);
