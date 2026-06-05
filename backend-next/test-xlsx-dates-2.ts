import * as XLSX from "xlsx";

const csvData = `"Name","Joining Date"\n"Rahul Sharma","2026-07-01"\n"Priya","01/07/2026"\n"Arjun","45108"`;
const workbook = XLSX.read(csvData, { type: "string", cellDates: true });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true });

console.log("Result:");
jsonData.forEach(row => {
  console.log(row['Name'], "=>", row['Joining Date'], "(type: " + typeof row['Joining Date'] + ", isDate: " + (row['Joining Date'] instanceof Date) + ")");
});
