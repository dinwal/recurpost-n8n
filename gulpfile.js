const { src, dest, parallel } = require('gulp');

function buildNodeIcons() {
  return src(['nodes/**/*.svg', 'nodes/**/*.png', 'nodes/**/*.node.json']).pipe(dest('dist/nodes'));
}

function buildCredentialIcons() {
  return src(['credentials/**/*.svg', 'credentials/**/*.png']).pipe(dest('dist/credentials'));
}

exports['build:icons'] = parallel(buildNodeIcons, buildCredentialIcons);
