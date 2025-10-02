import { getChats, saveChats } from '../../lib/github';
import { GITHUB_TOKEN, GITHUB_REPO } from '../../lib/config';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const chats = await getChats(GITHUB_TOKEN, GITHUB_REPO.owner, GITHUB_REPO.repo);
      
      // Find bot token in chats (this is a simple approach, you might want to improve it)
      const botTokenMessage = chats.find(chat => 
        chat.from === 'user' && 
        chat.text.startsWith('/settoken ')
      );
      
      if (botTokenMessage) {
        const token = botTokenMessage.text.replace('/settoken ', '');
        res.status(200).json({ token });
      } else {
        res.status(404).json({ message: 'Bot token not found' });
      }
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Bot token API error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
    }
