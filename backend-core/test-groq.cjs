const axios = require('axios');

const models = [
  'qwen/qwen3-32b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
  'allam-2-7b',
  'openai/gpt-oss-20b'
];

const groqToken = process.env.GROQ_API_KEY || "YOUR_API_KEY";

async function testModels() {
  for (const model of models) {
    console.log(`\nTesting model: ${model}`);
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: model,
          messages: [{ role: "user", content: "Say 'Hi' in valid JSON: {\"message\": \"Hi\"}" }],
          temperature: 1.0,
          response_format: { type: "json_object" }
        },
        {
          headers: { 
            'Authorization': `Bearer ${groqToken}`,
            'Content-Type': 'application/json' 
          },
          timeout: 10000 
        }
      );
      console.log(`✅ Success! Response: ${response.data.choices[0].message.content.trim()}`);
    } catch (error) {
      console.log(`❌ Failed! Error: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

testModels();
