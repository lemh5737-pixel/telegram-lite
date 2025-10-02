import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Contacts() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [telegramApiKey, setTelegramApiKey] = useState('');
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

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // First, check if we have a token in localStorage
        const savedToken = localStorage.getItem('telegramApiKey');
        if (savedToken) {
          setTelegramApiKey(savedToken);
        } else {
          // If no token, redirect to login
          router.push('/');
          return;
        }
        
        // Load initial chats
        const chatsResponse = await fetch('/api/chats');
        if (chatsResponse.ok) {
          const initialChats = await chatsResponse.json();
          setChats(initialChats);
        } else {
          throw new Error('Failed to load chats');
        }
        
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
    if (!telegramApiKey) return;
    
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
  }, [telegramApiKey]);

  const handleContactClick = (contact) => {
    // Navigate to chat page with the selected contact
    router.push({
      pathname: '/chat',
      query: { 
        chatId: contact.chatId,
        name: contact.name,
        username: contact.username
      }
    });
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
          <p className="mt-4 text-gray-700">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => router.push('/chat')}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Chat
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
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">All Contacts</h2>
            </div>
            <ul className="divide-y divide-gray-200">
              {uniqueUsers.length > 0 ? (
                uniqueUsers.map((user, index) => (
                  <li key={index}>
                    <div
                      className="block hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleContactClick(user)}
                    >
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-800 font-medium text-lg">
                              {user.name.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 ml-4">
                            <div>
                              <p className="text-sm font-medium text-indigo-600 truncate">
                                {user.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {user.username ? `@${user.username}` : ''} • {user.chatId}
                              </p>
                            </div>
                            <div className="mt-1">
                              <p className="text-sm text-gray-500 truncate">
                                {user.lastMessage}
                              </p>
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-400">
                              {new Date(user.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="px-4 py-12 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No contacts</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by sending a message to your bot.</p>
                </li>
              )}
            </ul>
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
