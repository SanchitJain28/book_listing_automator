const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const html = fs.readFileSync('page_dump.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;
const elements = document.querySelectorAll('div[data-component-type="s-search-result"]');
elements.forEach((el, i) => {
  const asin = el.getAttribute("data-asin") || "";
  
  // Use data-cy="title-recipe" as a stable anchor
  const titleContainer = el.querySelector('[data-cy="title-recipe"]');
  const titleEl = titleContainer ? titleContainer.querySelector('h2 span') : el.querySelector('h2 span');
  const title = titleEl ? titleEl.textContent.trim() : "";
  
  const linkEl = titleContainer ? titleContainer.querySelector('a.a-link-normal') : el.querySelector('a.a-link-normal');
  const link = linkEl ? linkEl.href : "";
  
  const priceEl = el.querySelector('.a-price-whole');
  const price = priceEl ? priceEl.textContent.trim() : "";
  
  console.log(`[${i}] ASIN: ${asin}, Title: ${title}, Link: ${link}, Price: ${price}`);
});
