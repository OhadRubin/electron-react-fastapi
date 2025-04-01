const fs = require('fs');
const { createCanvas } = require('canvas');

// Create a 512x512 icon
const size = 512;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Fill background
ctx.fillStyle = '#009688';
ctx.fillRect(0, 0, size, size);

// Draw a stylized 'F' for FastAPI
ctx.fillStyle = 'white';
ctx.font = 'bold 300px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('F', size / 2, size / 2);

// Save as PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('./icon.png', buffer);

console.log('Icon created successfully!');