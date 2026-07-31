#!/bin/bash
# VPS Setup Script for Book Listing Automator
# Run this on a fresh Ubuntu/Debian VPS

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting VPS Setup for Scraping..."

# 1. Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip wget xvfb libxi6 libgconf-2-4

# 2. Install Node.js (v22 - latest LTS for this environment)
echo "🟢 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clone the repository
# NOTE: If your repo is private, you will need to enter your GitHub username and Personal Access Token when prompted.
echo "📥 Cloning the repository..."
cd ~
if [ -d "book_listing_automator" ]; then
    echo "Directory 'book_listing_automator' already exists. Pulling latest changes..."
    cd book_listing_automator
    git pull origin main
else
    git clone https://github.com/SanchitJain28/book_listing_automator.git
    cd book_listing_automator
fi

# 4. Install NPM dependencies
echo "📦 Installing project dependencies..."
npm install

# 5. Install Playwright browsers and their system dependencies
echo "🎭 Installing Playwright browsers..."
npx playwright install chromium --with-deps

echo ""
echo "✅ Setup Complete!"
echo ""
echo "You can now run your scrapers in headless mode. For example:"
echo "cd ~/book_listing_automator"
echo "node scrapers/amazon-search-term/amazon-search-term-stage-1.js input-data/search-term-31thJuly/input.txt --headless"
