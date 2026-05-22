#!/bin/bash
# RaktSarthi Deployment Update Automation
# This script automates pulling the latest changes from GitHub, building the frontend, and restarting the backend.

echo "=================================================="
echo "🚀 Starting RaktSarthi Update Process..."
echo "=================================================="

# Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# Update and build Frontend
echo "📦 Building Frontend..."
cd frontend
npm install
CI=false npm run build

# Update Backend
echo "📦 Updating Backend..."
cd ../backend
npm install

# Restart Backend process in PM2
echo "🔄 Restarting Backend server in PM2..."
pm2 restart raktsarthi-backend

echo "=================================================="
echo "✨ Deployment updated and restarted successfully!"
echo "=================================================="
