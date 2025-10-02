import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [telegramApiKey, setTelegramApiKey] = useState('');
  const [githubRepo, setGithubRepo] = useState({ owner: '', repo: '' });
  const [isInitialized, setIsInitialized] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { chatId, messageId, telegramMessageId }
  const messagesEndRef = useRef(null);
  const router = useRouter();
  
  // Get unique users from chats (excluding system messages)
  const uniqueUsers = [...new Set(chats.filter(chat => chat.chatId !== 0).map(chat => chat.chatId))].map(chatId => {
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

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // First, check if we have a token in localStorage
        const savedToken = localStorage.getItem('telegramApiKey');
        if (savedToken) {
          setTelegramApiKey(savedToken);
        }
        
        // Get GitHub repo config
        const configResponse = await fetch('/api/config');
        if (configResponse.ok) {
          const { repo } = await configResponse.json();
          setGithubRepo(repo);
        } else {
          throw new Error('Failed to get repository configuration');
        }
        
        // If we don't have a token in localStorage, try to get it from GitHub
        if (!savedToken) {
          const tokenResponse = await fetch('/api/botToken');
          if (tokenResponse.ok) {
            const { token } = await tokenResponse.json();
            if (token) {
              setTelegramApiKey(token);
              // Save to localStorage for future use
              localStorage.setItem('telegramApiKey', token);
            } else {
              // No token found in GitHub either, redirect to login
              router.push('/');
              return;
            }
          } else {
            // If we can't get token from GitHub, redirect to login
            router.push('/');
            return;
          }
        }
        
        // Load initial chats
        const chatsResponse = await fetch('/api/chats');
        if (chatsResponse.ok) {
          const initialChats = await chatsResponse.json();
          setChats(initialChats);
          
          // Check if we have a chat ID in the query parameters
          const { chatId, name, username } = router.query;
          if (chatId) {
            setSelectedChat({
              chatId: parseInt(chatId),
              name: name || 'User',
              username: username || ''
            });
          } else {
            // Select the first user chat if available
            const userChats = initialChats.filter(chat => chat.chatId !== 0);
            if (userChats.length > 0) {
              const lastChat = userChats[userChats.length - 1];
              setSelectedChat({
                chatId: lastChat.chatId,
                name: lastChat.user,
                username: lastChat.username
              });
            }
          }
        } else {
          throw new Error('Failed to load chats');
        }
        
        setIsInitialized(true);
        setLoading(false);
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err.message || 'Failed to initialize app');
        setLoading(false);
      }
    };
    
    initializeApp();
  }, [router]);
  
  // Set up interval to check for new messages
  useEffect(() => {
    if (!isInitialized || !telegramApiKey) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/telegram', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'getUpdates',
            apiKey: telegramApiKey
          }),
        });
        
        if (response.ok) {
          const { chats: updatedChats } = await response.json();
          setChats(updatedChats);
        }
      } catch (err) {
        console.error('Error checking for new messages:', err);
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, [isInitialized, telegramApiKey]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || !selectedChat || !telegramApiKey) return;
    
    try {
      const response = await fetch('/api/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendMessage',
          apiKey: telegramApiKey,
          chatId: selectedChat.chatId,
          text: message
        }),
      });
      
      if (response.ok) {
        const { chats: updatedChats } = await response.json();
        setChats(updatedChats);
        setMessage('');
      } else {
        setError('Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    }
  };

  const handleDeleteMessage = async (messageId, telegramMessageId) => {
    try {
      // If it's a bot message, delete it from Telegram first
      if (telegramMessageId) {
        const deleteResponse = await fetch(`https://api.telegram.org/bot${telegramApiKey}/deleteMessage?chat_id=${selectedChat.chatId}&message_id=${telegramMessageId}`);
        const deleteData = await deleteResponse.json();
        
        if (!deleteData.ok) {
          console.error('Failed to delete message from Telegram:', deleteData.description);
          // Continue with deleting from local database even if Telegram deletion fails
        }
      }
      
      // Filter out the message to be deleted
      const updatedChats = chats.filter(chat => chat.id !== messageId);
      
      // Save updated chats to GitHub
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chats: updatedChats }),
      });
      
      if (response.ok) {
        setChats(updatedChats);
        setDeleteConfirm(null); // Close confirmation dialog
      } else {
        setError('Failed to delete message from database');
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      setError('Failed to delete message');
    }
  };

  const handleLogout = async () => {
    try {
      // Remove token from localStorage
      localStorage.removeItem('telegramApiKey');
      
      // Remove the token from GitHub database
      const chatsResponse = await fetch('/api/chats');
      const chats = await chatsResponse.json();
      
      // Filter out the token message
      const updatedChats = chats.filter(chat => 
        !(chat.chatId === 0 && chat.text.startsWith('/settoken '))
      );
      
      // Save updated chats
      await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chats: updatedChats }),
      });
      
      // Redirect to login page
      router.push('/');
    } catch (err) {
      console.error('Error during logout:', err);
      setError('Failed to logout properly');
    }
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
          <div className="flex space-x-2">
            <button
              onClick={() => router.push('/contacts')}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Contacts
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Logout
            </button>
          </div>
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
                          {user.username ? `@${user.username}` : ''} • {user.chatId}
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
                        {selectedChat.username ? `@${selectedChat.username}` : ''} • {selectedChat.chatId}
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
                          className={`flex ${chat.from === 'bot' ? 'justify-end' : chat.from === 'system' ? 'justify-center' : 'justify-start'}`}
                        >
                          {chat.from === 'system' ? (
                            <div className="text-xs text-gray-500 bg-gray-200 rounded-full px-3 py-1">
                              {chat.text}
                            </div>
                          ) : (
                            <div
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl relative group ${chat.from === 'bot' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none'}`}
                            >
                              <p>{chat.text}</p>
                              <p
                                className={`text-xs mt-1 ${chat.from === 'bot' ? 'text-indigo-200' : 'text-gray-500'}`}
                              >
                                {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              
                              {/* Delete button - only visible on hover */}
                              <button
                                onClick={() => setDeleteConfirm({ 
                                  chatId: chat.chatId, 
                                  messageId: chat.id,
                                  telegramMessageId: chat.telegramMessageId
                                })}
                                className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${chat.from === 'bot' ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-700'}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Message</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to delete this message? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteMessage(deleteConfirm.messageId, deleteConfirm.telegramMessageId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
