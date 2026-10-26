// Synthetic examples only; these are never represented as verified scraper data.
export const demoRecords = [
  { searched_isbn: '9780835212120', title: 'Scientific and Engineering Societies: Publications', author: 'James M. Turner', store: 'AbeBooks', price: 24.5, currency: 'USD', found: true, in_stock: true, isbn_matched: true, found_isbn: '9780835212120', seller: 'Northwood Books', scraped_at: '2026-10-24T10:00:00Z', url: 'https://www.abebooks.com/products/isbn/9780835212120', listings: [
    { title: 'Scientific and Engineering Societies: Publications', author: 'James M. Turner', price: 'US$ 24.50', price_num: 24.5, found_isbn: '9780835212120', isbn_match: true, seller: 'Northwood Books', seller_address: 'United States', shipping: 'US$ 8.25 shipping', binding: 'Hardcover', is_out_of_stock: false },
    { title: 'Scientific and Engineering Societies: Publications', author: 'James M. Turner', price: 'US$ 31.00', price_num: 31, found_isbn: '9780835212120', isbn_match: true, seller: 'The Reading Room', seller_address: 'United Kingdom', shipping: 'US$ 12.00 shipping', binding: 'Hardcover', is_out_of_stock: false },
  ] },
  { searched_isbn: '9780306406157', title: 'The Practice of Scientific Discovery', author: 'R. H. Michaels', store: 'AbeBooks UK', price: 18.75, currency: 'GBP', found: true, in_stock: true, isbn_matched: false, found_isbn: '9780306406164', seller: 'West End Books', binding: 'Paperback', scraped_at: '2026-10-24T10:01:00Z' },
  { searched_isbn: '9780140449136', title: 'A Study of Language and Meaning', author: 'Eleanor Hart', store: 'AbeBooks', currency: 'USD', found: true, in_stock: false, isbn_matched: true, price: null, seller: 'AbeBooks', scraped_at: '2026-10-24T10:02:00Z' },
  { searched_isbn: '9780141182636', title: 'Perspectives on Modern Literature', author: 'Oliver Reed', store: 'IberLibro', currency: 'EUR', price: 12.9, found: true, in_stock: true, seller: 'Librería del Sur', scraped_at: '2026-10-24T10:03:00Z' },
  { searched_isbn: '9780000000019', store: 'AbeBooks', found: false, in_stock: false, stock_status: 'Not Found', scraped_at: '2026-10-24T10:04:00Z' },
  { searched_isbn: '9780000000026', store: 'AbeBooks', error: 'Navigation timed out. Review this record before retrying.', scraped_at: '2026-10-24T10:05:00Z' },
];
