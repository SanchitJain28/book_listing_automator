Invoke-WebRequest -Uri https://github.com/SanchitJain28/book_listing_automator/archive/refs/heads/main.zip -OutFile scraper.zip; Expand-Archive -Path scraper.zip -DestinationPath .

cd book_listing_automator-main

Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

npm install
npx playwright install

node scraper.js 1may_isbn_list3.txt

## Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 1. Download the repository from GitHub
wget https://github.com/SanchitJain28/book_listing_automator/archive/refs/heads/main.zip

# 2. Unzip the downloaded file
unzip main.zip

# 3. Go into the newly created project directory
cd book_listing_automator-main

# 4. Install the Node.js libraries
npm install playwright axios form-data

# 5. Install the browser that Playwright needs
npx playwright install

# 6. Finally, run your script! 
# (Use the correct script and list name from your repo)
node scraper.js 1may_isbn_list1.txt