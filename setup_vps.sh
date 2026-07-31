#!/bin/bash
# VPS Setup Script for Book Listing Automator
# Run this on a fresh Ubuntu/Debian VPS

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting VPS Setup for Scraping..."

# 1. Update system packages
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git unzip wget

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

read -p "Enter VPS number (1-5) to start scraping automatically (or press Enter to skip): " vps_num

if [[ -n "$vps_num" ]]; then
    chunk_num=$((vps_num + 1))
    chunk_file="input-data/search-term-31thJuly/chunks/chunk-${chunk_num}-vps${vps_num}.txt"
    
    if [ -f "$chunk_file" ]; then
        echo "🚀 Starting scraper on ${chunk_file} in headless mode..."
        cd ~/book_listing_automator
        node scrapers/amazon-search-term/amazon-search-term-stage-1.js "$chunk_file" --headless
    else
        echo "❌ Error: Could not find ${chunk_file}. Make sure you pushed the latest chunks to GitHub!"
    fi
else
    echo "Skipping automatic execution. You can run it manually later!"
fi
