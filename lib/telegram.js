// Get updates from Telegram Bot API
export async function getUpdates(apiKey) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${apiKey}/getUpdates`);
    const data = await response.json();
    
    if (data.ok) {
      return data.result;
    } else {
      throw new Error(data.description);
    }
  } catch (error) {
    console.error('Error getting updates from Telegram:', error);
    return [];
  }
}

// Send message via Telegram Bot API
export async function sendMessage(apiKey, chatId, text) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${apiKey}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`,
      { method: 'POST' }
    );
    const data = await response.json();
    
    if (data.ok) {
      return data.result;
    } else {
      throw new Error(data.description);
    }
  } catch (error) {
    console.error('Error sending message to Telegram:', error);
    return null;
  }
}
