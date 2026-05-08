const fs = require('fs');
const code = fs.readFileSync('node_modules/react-map-gl/dist/esm/exports-maplibre.js', 'utf8');
console.log('Total lines:', code.split('\n').length);
console.log('Contains forwardRef:', code.includes('forwardRef'));
console.log('Contains Marker:', code.includes('Marker'));
console.log('Contains NavigationControl:', code.includes('NavigationControl'));
console.log('Has import maplibre-gl:', code.includes("import('maplibre-gl')"));
