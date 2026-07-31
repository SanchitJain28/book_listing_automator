const fs = require('fs');
(async () => {
  const res = await fetch('https://www.google.com/search?q=9780008501822+site%3Aamazon.com', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  });
  const text = await res.text();
  console.log("Status:", res.status);
  fs.writeFileSync('google_fetch.html', text);
})();
