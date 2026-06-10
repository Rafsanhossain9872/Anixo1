import axios from 'axios';

async function testChat() {
  try {
    const res = await axios.post('http://localhost:5001/api/ai/chat', {
      messages: [{ role: "user", content: "You are a stupid idiot chutiya" }]
    }, {
      headers: {
        // Need to simulate a logged-in user if the route requires AuthMiddleware.
        // Or wait, does the chat route work for guests now?
        // Ah, earlier we hid the chat UI for guests, but the API might still allow it?
        // Let's just try.
      }
    });
    console.log("SUCCESS:", res.data);
  } catch (error) {
    console.log("ERROR:", error.response?.data || error.message);
  }
}
testChat();
