#!/bin/bash
# Script to copy Bootstrap Icons fonts to public folder for offline support

# Create fonts directory if it doesn't exist
mkdir -p public/fonts

# Copy Bootstrap Icons font files from node_modules
if [ -d "node_modules/bootstrap-icons/font" ]; then
  cp node_modules/bootstrap-icons/font/bootstrap-icons.woff2 public/fonts/
  cp node_modules/bootstrap-icons/font/bootstrap-icons.woff public/fonts/
  echo "✓ Bootstrap Icons fonts copied to public/fonts/"
else
  echo "✗ Bootstrap Icons fonts not found in node_modules"
  exit 1
fi

echo "✓ Fonts setup complete for offline support"
