// Metro must treat the ONNX model and the offline map files (PMTiles, font glyphs) as bundled assets (not as source code).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('onnx', 'pmtiles', 'pbf');

module.exports = config;
