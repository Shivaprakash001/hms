import fs from 'fs';
import path from 'path';

const apiDir = '/Users/valurothusharan/Desktop/hms/hms/backend-next/app/api';

function getFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, files);
    } else if (item === 'route.ts') {
      files.push(fullPath);
    }
  }
  return files;
}

const routes = getFiles(apiDir);
const report = [];

for (const route of routes) {
  const content = fs.readFileSync(route, 'utf8');
  const relPath = path.relative('/Users/valurothusharan/Desktop/hms/hms', route);
  
  const issues = [];
  
  // Check for try/catch
  if (!content.includes('try {') || !content.includes('catch')) {
    issues.push('Missing try/catch block');
  }
  
  // Check for req.json() safety
  if (content.includes('req.json()') && !content.includes('.catch(') && !content.includes('try {')) {
    issues.push('Unsafe req.json() (potential crash on empty body)');
  }
  
  // Check for standardized error structure
  if (content.includes('catch') && !content.includes('Response.json') && !content.includes('success: false')) {
    issues.push('Non-standard error response structure');
  }

  // Check for logging in catch
  if (content.includes('catch') && !content.includes('console.error')) {
    issues.push('Missing console.error in catch block');
  }

  if (issues.length > 0) {
    report.push({ path: relPath, issues });
  }
}

console.log(JSON.stringify(report, null, 2));
