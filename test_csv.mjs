import { AsyncParser } from '@json2csv/node';
const parser = new AsyncParser();
parser.parse([{a:1, b:2}]).promise().then(csv => console.log(csv)).catch(err => console.error(err));
