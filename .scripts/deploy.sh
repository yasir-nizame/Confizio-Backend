#!/bin/bash
set -e

echo "Deployment started..."


# Make sure NVM is available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Pull the latest version of the app
git pull origin main
echo "New changes copied to server !"

# Installing Dependencies
echo "Installing Dependencies..."
npm install --yes


# Restarting server
echo "Restarting server"
pm2 restart confizio-api

echo "Deployment Finished!"
