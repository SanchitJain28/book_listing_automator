function isbn13To10(isbn13) {
  if (isbn13.length !== 13 || !isbn13.startsWith('978')) return null;
  let core = isbn13.substring(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(core[i]) * (10 - i);
  }
  let check = 11 - (sum % 11);
  if (check === 10) check = 'X';
  else if (check === 11) check = '0';
  return core + check;
}
console.log(isbn13To10('9780008501822'));
