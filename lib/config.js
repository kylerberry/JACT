const yaml = require('js-yaml');
const fs = require('fs');

try {
  var options = yaml.safeLoad(fs.readFileSync('./config.yaml', 'utf8'));
  module.exports = options
} catch (e) {
  console.log(e);
}