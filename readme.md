# PropFirm Intelligent Assistant

A customer-facing chatbot for proprietary trading firms that explains rules, challenges, risk limits, payouts, and operational policies.

## Features

- Explains prop firm rules and policies
- Handles contextual follow-up questions
- Built-in satisfaction tracking
- Escalation to customer care when needed
- Secure API key management

## Setup

1. Clone the repository:
```bash
git clone https://github.com/Chandan2909-commits/chatbot-1.git
cd chatbot-1
```

2. Create your config file:
```bash
copy config.example.js config.js
```

3. Edit `config.js` and replace `YOUR_API_KEY_HERE` with your actual Groq API key:
```javascript
const GROQ_API_KEY = "your_actual_groq_api_key_here";
```

4. Open `index.html` in your browser or serve it using a local server.

## Security

- Never commit your `config.js` file (it's already in `.gitignore`)
- The `config.example.js` shows the required format without exposing keys
- Always use the example file as a template for new deployments

## Deployment

For production deployment, ensure your hosting platform supports environment variables and update the code to use them instead of the config file.

## License

MIT License