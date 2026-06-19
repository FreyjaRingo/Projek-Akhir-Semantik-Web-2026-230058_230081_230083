const fs = require('fs');
const content = fs.readFileSync('app/admin/graph/page.tsx', 'utf8');

// Remove strings
let clean = '';
let inStr = false;
let strChar = '';
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (!inStr && (c === '"' || c === "'" || c === '`')) {
    inStr = true;
    strChar = c;
    clean += c;
  } else if (inStr && c === strChar && content[i-1] !== '\\') {
    inStr = false;
    clean += c;
  } else {
    clean += c;
  }
}

// Remove comments
clean = clean.replace(/\/\/.*$/gm, '');
clean = clean.replace(/\/\*[\s\S]*?\*\//g, '');

let curly = 0, paren = 0, bracket = 0;
let line = 1, problemLine = 0;

for (let i = 0; i < clean.length; i++) {
  if (clean[i] === '\n') { line++; continue; }

  if (clean[i] === '{') curly++;
  if (clean[i] === '}') { curly--; if (curly < 0) problemLine = line; }
  if (clean[i] === '(') paren++;
  if (clean[i] === ')') { paren--; if (paren < 0) problemLine = line; }
  if (clean[i] === '[') bracket++;
  if (clean[i] === ']') { bracket--; if (bracket < 0) problemLine = line; }
}

console.log('Brackets: curly=' + curly + ', paren=' + paren + ', bracket=' + bracket);
if (problemLine) console.log('Problem at line:', problemLine);
