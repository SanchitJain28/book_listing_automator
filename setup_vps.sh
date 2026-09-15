#!/bin/bash
# VPS Setup Script for Book Listing Automator
# Tested & working on Ubuntu 24.04 and Ubuntu 26.04 LTS

set -e

echo "🚀 Starting VPS Setup for Scraping..."

# 0. Wait for automatic system background updates to finish releasing locks
echo "⏳ Checking and waiting for background package manager locks..."
systemctl stop unattended-upgrades apt-daily.service apt-daily-upgrade.service 2>/dev/null || true
while fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/lib/dpkg/lock /var/cache/apt/archives/lock >/dev/null 2>&1; do
    echo "Waiting for background system update process to release dpkg lock..."
    sleep 3
done

# 1. Update system packages non-interactively and install required libraries
echo "📦 Installing system packages & Chromium shared libraries..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  curl git unzip wget build-essential \
  libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 \
  libcairo2 libcups2t64 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 \
  libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
  libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2 fonts-liberation xdg-utils

# 2. Install Node.js (v22 LTS)
echo "🟢 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# 3. Clone repository via Git
echo "📥 Setting up project directory from GitHub..."
cd ~
if [ -d "/root/book_listing_automator/.git" ]; then
    echo "Directory exists as a git repo. Pulling latest main..."
    cd /root/book_listing_automator
    git pull origin main
else
    echo "Cloning fresh repository..."
    if [ -f "/root/book_listing_automator/.env" ]; then
        cp /root/book_listing_automator/.env /tmp/.env.backup
    fi
    rm -rf /root/book_listing_automator
    git clone https://github.com/SanchitJain28/book_listing_automator.git /root/book_listing_automator
    if [ -f "/tmp/.env.backup" ]; then
        mv /tmp/.env.backup /root/book_listing_automator/.env
    fi
    cd /root/book_listing_automator
fi

# 4. Install NPM dependencies
echo "📦 Installing project dependencies..."
npm install

# 5. Patch Playwright OS detection for Ubuntu 26.04 compatibility & install Chromium
echo "🎭 Installing Playwright Chromium browser..."
if [ -f "node_modules/playwright-core/lib/server/utils/hostPlatform.js" ]; then
    sed -i 's/major < 26/major < 28/g' node_modules/playwright-core/lib/server/utils/hostPlatform.js
fi

npx playwright install chromium

# 6. Verify Playwright Chromium Launch
echo "🧪 Verifying Playwright browser launch..."
node -e "const { chromium } = require('playwright'); (async () => { const b = await chromium.launch(); console.log('✅ Browser launched successfully!'); await b.close(); })();"

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "🎉 VPS Setup Complete & Verified!"
echo "Node: $(node -v) | NPM: $(npm -v)"
echo "══════════════════════════════════════════════════════════════"
echo ""
