const fs = require('fs');

const apiKey = process.env.GROQ_API_KEY || "API_KEY_NOT_SET";
const content = `const GROQ_API_KEY = "${apiKey}";`;

fs.writeFileSync('config.js', content);
console.log('config.js successfully generated from environment variables.');
