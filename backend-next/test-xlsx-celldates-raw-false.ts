import * as XLSX from "xlsx";

const csvData = `"Name","Email","Phone","Room","Monthly Rent","Joining Date","Deposit","Notes"\n"Rahul Sharma","rahul.sharma.test1@gmail.com","9876543210","G1","8500","2026-07-01","25500","Computer Science student"\n"Arjun","a@b.com","9876543211","G2","9000","05/07/2026","27000","Vegetarian"`;
const workbook = XLSX.read(csvData, { type: "string", cellDates: true });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

const jsonDataRawFalse = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });

console.log("raw: false, cellDates: true =>");
console.dir(jsonDataRawFalse, { depth: null });
