import { parseOutput } from './output.js';

function parseDelimited(content, separator) {
  const rows = [];
  let row = [], field = '', quoted = false, afterQuote = false;
  const source = content.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else field += char;
    } else if (char === separator) { row.push(field); field = ''; afterQuote = false; }
    else if (char === '\n' || char === '\r') {
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = []; field = ''; afterQuote = false;
      if (char === '\r' && source[i + 1] === '\n') i++;
    } else if (char === '"' && !field && !afterQuote) quoted = true;
    else if (afterQuote && !/\s/.test(char)) throw new Error('Invalid CSV: unexpected text after a quoted field.');
    else if (!afterQuote) field += char;
  }
  if (quoted) throw new Error('Invalid CSV: an opening quote has no closing quote.');
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error('This file needs a header row and at least one data row.');
  const headers = rows.shift().map(header => header.trim());
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) throw new Error('Column headers must be nonempty and unique.');
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 2} has ${values.length} values; expected ${headers.length}.`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}

export function parseDataFile(content, name) {
  const extension = name.split('.').pop().toLowerCase();
  if (extension === 'csv' || extension === 'tsv') return { records: parseDelimited(content, extension === 'tsv' ? '\t' : ','), kind: 'table' };
  if (extension === 'txt' && !/^[\s\uFEFF]*[\[{]/.test(content)) {
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) throw new Error('This text file is empty.');
    if (lines.every(line => /^(?:\d[\d -]{8,15}[\dXx])$/.test(line))) return { records: lines.map(searched_isbn => ({ searched_isbn })), kind: 'books' };
    return { records: lines.map((text, index) => ({ line: index + 1, text })), kind: 'table' };
  }
  // Summary reports are also useful project outputs; unwrap their result array.
  try {
    const value = JSON.parse(content.replace(/^\uFEFF/, ''));
    if (value && !Array.isArray(value) && Array.isArray(value.results)) return { records: parseOutput(JSON.stringify(value.results)), kind: 'books' };
  } catch { /* JSON Lines and malformed JSON are diagnosed by parseOutput. */ }
  return { records: parseOutput(content), kind: 'books' };
}
