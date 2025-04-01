#!/bin/bash

# Convert SVG to PNG
rsvg-convert -h 512 icon.svg > icon.png
echo "Converted SVG to PNG"

# Create macOS iconset
mkdir -p AppIcon.iconset
echo "Created iconset directory"

# Generate different icon sizes
sips -z 16 16 icon.png --out AppIcon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out AppIcon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out AppIcon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out AppIcon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out AppIcon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out AppIcon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out AppIcon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out AppIcon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out AppIcon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out AppIcon.iconset/icon_512x512@2x.png
echo "Generated icon sizes"

# Create icns file
iconutil -c icns AppIcon.iconset
echo "Created icns file"

# Create icon for Windows (ico)
echo "Done! Created icon.png and AppIcon.icns" 