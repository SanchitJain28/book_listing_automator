Invoke-WebRequest -Uri https://github.com/SanchitJain28/book_listing_automator/archive/refs/heads/main.zip -OutFile scraper.zip; Expand-Archive -Path scraper.zip -DestinationPath .

cd book_listing_automator-main

Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

npm install
npx playwright install

node scraper.js 1may_isbn_list3.txt
