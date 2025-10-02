import { getUpdates, sendMessage } from '../../lib/telegram';
import { getChats, saveChats, getUsers, saveUsers } from '../../lib/github';
import { GITHUB_TOKEN, GITHUB_REPO } from '../../lib/config';

export default async function handler(req, res) {
  try {
    // Check if GitHub token is properly set
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ 
        message: 'GitHub token is not properly set in environment variables' 
      });
    }
    
    if (req.method === 'POST') {
      const { action, apiKey, chatId, text } = req.body;
      
      if (action === 'getUpdates') {
        const updates = await getUpdates(apiKey);
        
        // Get current chats
        const currentChats = await getChats(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo);
        
        // Get current users
        const currentUsers = await getUsers(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo);
        
        // Process new messages and update users
        const newChats = [...currentChats];
        const newUsers = [...currentUsers];
        
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
              
              // Check if user already exists in users list
              const userExists = newUsers.some(u => u.chatId === chatId);
              
              if (!userExists) {
                newUsers.push({
                  chatId,
                  name: user,
                  username,
                  lastMessage: text,
                  lastMessageTime: timestamp,
                  firstContactTime: timestamp
                });
              } else {
                // Update user's last message
                const userIndex = newUsers.findIndex(u => u.chatId === chatId);
                if (userIndex !== -1) {
                  newUsers[userIndex] = {
                    ...newUsers[userIndex],
                    lastMessage: text,
                    lastMessageTime: timestamp
                  };
                }
              }
            }
          }
        }
        
        // Save updated chats if there are new messages
        if (newChats.length > currentChats.length) {
          await saveChats(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo, newChats);
        }
        
        // Save updated users if there are new users or updated messages
        if (newUsers.length > currentUsers.length || 
            JSON.stringify(newUsers) !== JSON.stringify(currentUsers)) {
          await saveUsers(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo, newUsers);
        }
        
        res.status(200).json({ updates, chats: newChats, users: newUsers });
      } else if (action === 'sendMessage') {
        const result = await sendMessage(apiKey, chatId, text);
        
        if (result) {
          // Get current chats
          const currentChats = await getChats(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo);
          
          // Get current users
          const currentUsers = await getUsers(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo);
          
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
          
          // Update user's last message
          const updatedUsers = [...currentUsers];
          const userIndex = updatedUsers.findIndex(u => u.chatId === chatId);
          
          if (userIndex !== -1) {
            updatedUsers[userIndex] = {
              ...updatedUsers[userIndex],
              lastMessage: text,
              lastMessageTime: new Date().toISOString()
            };
          }
          
          // Save to GitHub
          await saveChats(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo, updatedChats);
          await saveUsers(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo, updatedUsers);
          
          res.status(200).json({ result, chats: updatedChats, users: updatedUsers });
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
