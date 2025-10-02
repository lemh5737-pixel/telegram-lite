import { getUpdates, sendMessage } from '../../lib/telegram';
import { getChats, saveChats } from '../../lib/github';
import { GITHUB_TOKEN, GITHUB_REPO } from '../../lib/config';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { action, apiKey, chatId, text } = req.body;
      
      if (action === 'getUpdates') {
        const updates = await getUpdates(apiKey);
        
        // Get current chats
        const currentChats = await getChats(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo);
        
        // Process new messages
        const newChats = [...currentChats];
        
        for (const update of updates) {
          if (update.message && update.message.text) {
            const message = update.message;
            const chatId = message.chat.id;
            const user = message.from.first_name + (message.from.last_name ? ' ' + message.from.last_name : '');
            const username = message.from.username || '';
            const text = message.text;
            const timestamp = new Date().toISOString();
            
            // Check if message already exists
            const exists = currentChats.some(chat => 
              chat.chatId === chatId && 
              chat.text === text && 
              Math.abs(new Date(chat.timestamp).getTime() - new Date(timestamp).getTime()) < 5000
            );
            
            if (!exists) {
              newChats.push({
                id: newChats.length + 1,
                chatId,
                user,
                username,
                text,
                from: 'user',
                timestamp,
                telegramMessageId: message.message_id // Store Telegram message ID for deletion
              });
            }
          }
        }
        
        // Save updated chats if there are new messages
        if (newChats.length > currentChats.length) {
          await saveChats(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo, newChats);
        }
        
        res.status(200).json({ updates, chats: newChats });
      } else if (action === 'sendMessage') {
        const result = await sendMessage(apiKey, chatId, text);
        
        if (result) {
          // Get current chats
          const currentChats = await getChats(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo);
          
          // Add bot message to chats
          const newMessage = {
            id: currentChats.length + 1,
            chatId,
            user: 'Bot',
            username: 'bot',
            text,
            from: 'bot',
            timestamp: new Date().toISOString(),
            telegramMessageId: result.message_id // Store Telegram message ID for deletion
          };
          
          const updatedChats = [...currentChats, newMessage];
          
          // Save to GitHub
          await saveChats(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo, updatedChats);
          
          res.status(200).json({ result, chats: updatedChats });
        } else {
          res.status(500).json({ message: 'Failed to send message' });
        }
      } else {
        res.status(400).json({ message: 'Invalid action' });
      }
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Telegram API error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
