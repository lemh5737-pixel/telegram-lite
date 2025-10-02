import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { getUpdates, sendMessage } from '../lib/telegram';
import { getChats, saveChats } from '../lib/github';

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const router = useRouter();
  
  // GitHub repository configuration
  const githubRepo = {
    owner: 'lemh5737-pixel',
    repo: 'telegram-lite-db'
  };
  
  // Get unique users from chats
  const uniqueUsers = [...new Set(chats.map(chat => chat.chatId))].map(chatId => {
    const userChat = chats.find(chat => chat.chatId === chatId);
    return {
      chatId,
      name: userChat.user,
      username: userChat.username,
      lastMessage: userChat.text,
      timestamp: userChat.timestamp
    };
  });

  // Filter chats for selected user
  const userChats = selectedChat 
    ? chats.filter(chat => chat.chatId === selectedChat.chatId)
    : [];

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [userChats]);

  // Check if user is logged in
  useEffect(() => {
    const telegramApiKey = localStorage.getItem('telegramApiKey');
    const githubToken = localStorage.getItem('githubToken');
    
    if (!telegramApiKey || !githubToken) {
      router.push('/');
      return;
    }
    
    // Load initial chats
    const loadChats = async () => {
      try {
        const initialChats = await getChats(
          githubToken,
          githubRepo.owner,
          githubRepo.repo
        );
        setChats(initialChats);
        
        if (initialChats.length > 0) {
          setSelectedChat({
            chatId: initialChats[initialChats.length - 1].chatId,
            name: initialChats[initialChats.length - 1].user,
            username: initialChats[initialChats.length - 1].username
          });
        }
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load chats');
        setLoading(false);
      }
    };
    
    loadChats();
    
    // Set up interval to check for new messages
    const interval = setInterval(async () => {
      const telegramApiKey = localStorage.getItem('telegramApiKey');
      const githubToken = localStorage.getItem('githubToken');
      
      if (telegramApiKey && githubToken) {
        try {
          // Get updates from Telegram
          const updates = await getUpdates(telegramApiKey);
          
          if (updates.length > 0) {
            // Get current chats
            const currentChats = await getChats(
              githubToken,
              githubRepo.owner,
              githubRepo.repo
            );
            
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
                    timestamp
                  });
                }
              }
            }
            
            // Save updated chats
            if (newChats.length > currentChats.length) {
              await saveChats(
                githubToken,
                githubRepo.owner,
                githubRepo.repo,
                newChats
              );
              setChats(newChats);
            }
          }
        } catch (err) {
          console.error('Error checking for new messages:', err);
        }
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [router]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || !selectedChat) return;
    
    const telegramApiKey = localStorage.getItem('telegramApiKey');
    const githubToken = localStorage.getItem('githubToken');
    
    if (!telegramApiKey || !githubToken) {
      router.push('/');
      return;
    }
    
    try {
      // Send message to Telegram
      const result = await sendMessage(telegramApiKey, selectedChat.chatId, message);
      
      if (result) {
        // Add message to local state
        const newMessage = {
          id: chats.length + 1,
          chatId: selectedChat.chatId,
          user: 'Bot',
          username: 'bot',
          text: message,
          from: 'bot',
          timestamp: new Date().toISOString()
        };
        
        const updatedChats = [...chats, newMessage];
        setChats(updatedChats);
        
        // Save to GitHub
        await saveChats(
          githubToken,
          githubRepo.owner,
          githubRepo.repo,
          updatedChats
        );
        
        // Clear input
        setMessage('');
      } else {
        setError('Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('telegramApiKey');
    localStorage.removeItem('githubToken');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Telegram Lite</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-grow flex">
        <div className="flex flex-col md:flex-row w-full max-w-7xl mx-auto">
          {/* Sidebar */}
          <div className="w-full md:w-1/3 bg-white border-r border-gray-200 overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Chats</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {uniqueUsers.length > 0 ? (
                uniqueUsers.map((user, index) => (
                  <div
                    key={index}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedChat && selectedChat.chatId === user.chatId ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedChat({
                      chatId: user.chatId,
                      name: user.name,
                      username: user.username
                    })}
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-800 font-medium">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3 overflow-hidden">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {user.username ? `@${user.username}` : ''}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {user.lastMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No chats yet
                </div>
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="w-full md:w-2/3 flex flex-col">
            {selectedChat ? (
              <>
                {/* Chat header */}
                <div className="bg-white p-4 border-b border-gray-200">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-800 font-medium">
                        {selectedChat.name.charAt(0)}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {selectedChat.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {selectedChat.username ? `@${selectedChat.username}` : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-grow overflow-y-auto p-4 bg-gray-100">
                  {userChats.length > 0 ? (
                    <div className="space-y-4">
                      {userChats.map((chat, index) => (
                        <div
                          key={index}
                          className={`flex ${chat.from === 'bot' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl ${chat.from === 'bot' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}`}
                          >
                            <p>{chat.text}</p>
                            <p
                              className={`text-xs mt-1 ${chat.from === 'bot' ? 'text-indigo-200' : 'text-gray-500'}`}
                            >
                              {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No messages yet. Start a conversation!</p>
                    </div>
                  )}
                </div>

                {/* Message input */}
                <div className="bg-white p-4 border-t border-gray-200">
                  <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-grow px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-100">
                <p className="text-gray-500">Select a chat to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
  }
