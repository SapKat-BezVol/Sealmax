const fs = require('fs');
const path = require('path');

test('index includes logo and favicon', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  expect(html).toMatch(/<link[^>]*rel=["']icon["'][^>]*href=["']logo\.png["']/);
  const images = html.match(/<img[^>]*src=["']logo\.png["']/g) || [];
  expect(images.length).toBeGreaterThanOrEqual(3);
});
