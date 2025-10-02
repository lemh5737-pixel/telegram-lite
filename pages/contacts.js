import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Contacts() {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [telegramApiKey, setTelegramApiKey] = useState('');
  const [newContact, setNewContact] = useState({ username: '', userId: '' });
  const [showAddContact, setShowAddContact] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
  
  // Filter users based on search term
  const filteredUsers = uniqueUsers.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
    user.chatId.toString().includes(searchTerm)
  );

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
          throw new Error('Gagal muat chat');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Initialization error:', err);
        setError(err.message || 'Gagal inisialisasi aplikasi');
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

  const handleAddContact = async (e) => {
    e.preventDefault();
    
    if (!newContact.username && !newContact.userId) {
      setError('Username atau ID User wajib diisi!');
      return;
    }
    
    setIsAdding(true);
    setError('');
    
    try {
      let chatId = null;
      let userInfo = null;
      
      // If username is provided, try to get user info
      if (newContact.username) {
        const response = await fetch(`https://api.telegram.org/bot${telegramApiKey}/getChat?chat_id=@${newContact.username}`);
        const data = await response.json();
        
        if (data.ok) {
          chatId = data.result.id;
          userInfo = {
            name: data.result.first_name + (data.result.last_name ? ' ' + data.result.last_name : ''),
            username: data.result.username || ''
          };
        } else {
          throw new Error(`User @${newContact.username} nggak ketemu`);
        }
      } 
      // If userId is provided, try to get user info
      else if (newContact.userId) {
        const response = await fetch(`https://api.telegram.org/bot${telegramApiKey}/getChat?chat_id=${newContact.userId}`);
        const data = await response.json();
        
        if (data.ok) {
          chatId = data.result.id;
          userInfo = {
            name: data.result.first_name + (data.result.last_name ? ' ' + data.result.last_name : ''),
            username: data.result.username || ''
          };
        } else {
          throw new Error(`User dengan ID ${newContact.userId} nggak ketemu`);
        }
      }
      
      if (chatId && userInfo) {
        // Add a system message to initiate the chat
        const chatsResponse = await fetch('/api/chats');
        const currentChats = await chatsResponse.json();
        
        const systemMessage = {
          id: currentChats.length + 1,
          chatId,
          user: userInfo.name,
          username: userInfo.username,
          text: 'Chat dimulai',
          from: 'system',
          timestamp: new Date().toISOString()
        };
        
        const updatedChats = [...currentChats, systemMessage];
        
        // Save updated chats
        await fetch('/api/chats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chats: updatedChats }),
        });
        
        // Update local state
        setChats(updatedChats);
        
        // Reset form
        setNewContact({ username: '', userId: '' });
        setShowAddContact(false);
        
        // Navigate to chat page
        router.push({
          pathname: '/chat',
          query: { 
            chatId,
            name: userInfo.name,
            username: userInfo.username
          }
        });
      }
    } catch (err) {
      console.error('Error adding contact:', err);
      setError(err.message || 'Gagal tambah kontak');
    } finally {
      setIsAdding(false);
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
      setError('Gagal logout dengan benar');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-700">Lagi muat kontak...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="ml-3 text-2xl font-bold text-gray-900">Kontak</h1>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAddContact(!showAddContact)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all transform hover:scale-105"
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Tambah
              </div>
            </button>
            <button
              onClick={() => router.push('/chat')}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-105"
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat
              </div>
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all transform hover:scale-105"
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Keluar
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Add Contact Form */}
      {showAddContact && (
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username (tanpa @)
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="username"
                    id="username"
                    value={newContact.username}
                    onChange={(e) => setNewContact({...newContact, username: e.target.value, userId: ''})}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-xl p-3 border"
                    placeholder="nama_pengguna"
                  />
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">ATAU</span>
                </div>
              </div>
              
              <div>
                <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                  ID User
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="userId"
                    id="userId"
                    value={newContact.userId}
                    onChange={(e) => setNewContact({...newContact, userId: e.target.value, username: ''})}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-xl p-3 border"
                    placeholder="123456789"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddContact(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-all transform hover:scale-105"
                >
                  {isAdding ? 'Lagi nambah...' : 'Tambah Kontak'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Cari kontak..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white shadow overflow-hidden sm:rounded-xl my-4">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Semua Kontak ({filteredUsers.length})</h2>
            </div>
            <ul className="divide-y divide-gray-200">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user, index) => (
                  <li key={index}>
                    <div
                      className="block hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleContactClick(user)}
                    >
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-14 w-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              {user.name.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 ml-4">
                            <div>
                              <p className="text-sm font-medium text-indigo-600 truncate">
                                {user.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {user.username ? `@${user.username}` : 'No username'} • {user.chatId}
                              </p>
                            </div>
                            <div className="mt-1">
                              <p className="text-sm text-gray-500 truncate">
                                {user.lastMessage}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="text-sm text-gray-400">
                              {new Date(user.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="mt-1">
                              <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="px-4 py-12 text-center">
                  <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada kontak</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Mulai dengan tambah kontak atau tunggu seseorang chat bot.
                  </p>
                </li>
              )}
            </ul>
          </div>
        </div>
      </main>

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-xl shadow-lg animate-pulse">
          {error}
        </div>
      )}
    </div>
  );
}
