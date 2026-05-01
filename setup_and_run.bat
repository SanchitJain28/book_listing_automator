@echo off
:: This script will automatically set up and run the Amazon scraper.

echo =================================================================
echo  Amazon Book Scraper - Automated Setup
echo =================================================================
echo.

:: Ask the user which list they are assigned to
set /p list_number="Enter your assigned list number (1 to 7) and press Enter: "

:: Construct the full filename based on their input
set list_file=1may_isbn_list%list_number%.txt

echo.
echo Thank you! Preparing to run the list: %list_file%
echo.
echo =================================================================
echo  STEP 1: DOWNLOADING THE PROJECT FROM GITHUB...
echo =================================================================
powershell -Command "Invoke-WebRequest -Uri https://github.com/SanchitJain28/book_listing_automator/archive/refs/heads/main.zip -OutFile book_scraper.zip"

echo.
echo =================================================================
echo  STEP 2: UNZIPPING THE FILES...
echo =================================================================
powershell -Command "Expand-Archive -Path book_scraper.zip -DestinationPath ."

:: Navigate into the newly created folder (GitHub adds "-main" to the end)
cd book_listing_automator-main

echo.
echo =================================================================
echo  STEP 3: INSTALLING REQUIRED LIBRARIES (This may take a minute)
echo =================================================================
npm install

echo.
echo =================================================================
echo  STEP 4: INSTALLING THE AUTOMATED BROWSER (This may take a minute)
echo =================================================================
npx playwright install

echo.
echo =================================================================
echo  SETUP COMPLETE! STARTING THE SCRAPER...
echo =================================================================
echo.

:: Run the scraper, passing the chosen list file as an argument
node scraper.js %list_file%

echo.
echo =================================================================
echo  SCRIPT HAS FINISHED!
echo =================================================================
echo The output file has been sent to the main server. You can now close this window.
echo.

:: Pause at the end to keep the window open so they can see the final message.
pause