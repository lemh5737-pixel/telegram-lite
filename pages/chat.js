import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [telegramApiKey, setTelegramApiKey] = useState('');
  const [githubRepo, setGithubRepo] = useState({ owner: '', repo: '' });
  const [isInitialized, setIsInitialized] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { chatId, messageId, telegramMessageId }
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef(null);
  const router = useRouter();
  
  // Get unique users from users data
  const uniqueUsers = users.map(user => ({
    chatId: user.chatId,
    name: user.name,
    username: user.username,
    lastMessage: user.lastMessage,
    timestamp: user.lastMessageTime
  }));

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
        } else {
          // If no token, redirect to login
          router.push('/');
          return;
        }
        
        // Get GitHub repo config
        const configResponse = await fetch('/api/config');
        if (configResponse.ok) {
          const { repo } = await configResponse.json();
          setGithubRepo(repo);
        } else {
          throw new Error('Gagal ambil konfigurasi repo');
        }
        
        // Load initial users
        const usersResponse = await fetch('/api/users');
        if (usersResponse.ok) {
          const initialUsers = await usersResponse.json();
          setUsers(initialUsers);
        } else {
          throw new Error('Gagal muat data pengguna');
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
            if (initialUsers.length > 0) {
              const lastUser = initialUsers[initialUsers.length - 1];
              setSelectedChat({
                chatId: lastUser.chatId,
                name: lastUser.name,
                username: lastUser.username
              });
            }
          }
        } else {
          throw new Error('Gagal muat chat');
        }
        
        setIsInitialized(true);
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
          const { chats: updatedChats, users: updatedUsers } = await response.json();
          setChats(updatedChats);
          setUsers(updatedUsers);
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
        const { chats: updatedChats, users: updatedUsers } = await response.json();
        setChats(updatedChats);
        setUsers(updatedUsers);
        setMessage('');
      } else {
        setError('Gagal kirim pesan');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Gagal kirim pesan');
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
        setError('Gagal hapus pesan dari database');
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      setError('Gagal hapus pesan');
    }
  };

  const handleLogout = async () => {
    try {
      // Remove token from localStorage
      localStorage.removeItem('telegramApiKey');
      
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
          <p className="mt-4 text-gray-700">Lagi muat chat...</p>
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
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="md:hidden mr-2 p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h1 className="ml-3 text-2xl font-bold text-gray-900">Chat</h1>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => router.push('/contacts')}
              className="hidden md:flex px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-105"
            >
              <div className="flex items-center">
                <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Kontak
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

      {/* Main content */}
      <main className="flex-grow flex overflow-hidden">
        {/* Mobile sidebar overlay */}
        {showSidebar && (
          <div 
            className="fixed inset-0 z-20 bg-black bg-opacity-50 md:hidden"
            onClick={() => setShowSidebar(false)}
          ></div>
        )}
        
        <div className="flex flex-col md:flex-row w-full max-w-7xl mx-auto">
          {/* Sidebar */}
          <div className={`${showSidebar ? 'absolute inset-y-0 left-0 z-30 w-3/4 max-w-xs' : 'hidden'} md:block md:w-1/3 bg-white border-r border-gray-200 overflow-y-auto shadow-lg md:shadow-none`}>
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Chat ({uniqueUsers.length})</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {uniqueUsers.length > 0 ? (
                uniqueUsers.map((user, index) => (
                  <div
                    key={index}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedChat && selectedChat.chatId === user.chatId ? 'bg-blue-50' : ''}`}
                    onClick={() => {
                      setSelectedChat({
                        chatId: user.chatId,
                        name: user.name,
                        username: user.username
                      });
                      setShowSidebar(false);
                    }}
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold">
                          {user.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-3 overflow-hidden">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {user.username ? `@${user.username}` : 'No username'} • {user.chatId}
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
                  Belum ada chat
                </div>
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="w-full md:w-2/3 flex flex-col">
            {selectedChat ? (
              <>
                {/* Chat header */}
                <div className="bg-white p-4 border-b border-gray-200 shadow-sm">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-lg">
                        {selectedChat.name.charAt(0)}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {selectedChat.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {selectedChat.username ? `@${selectedChat.username}` : 'No username'} • {selectedChat.chatId}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-grow overflow-y-auto p-4 bg-gradient-to-b from-white to-gray-100">
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
                              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl relative group ${chat.from === 'bot' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none shadow-sm'}`}
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
                      <div className="text-center">
                        <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada pesan</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          Mulai percakapan dengan kirim pesan
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Message input */}
                <div className="bg-white p-4 border-t border-gray-200 shadow-sm">
                  <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Ketik pesan..."
                      className="flex-grow px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-105"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full bg-gradient-to-b from-white to-gray-100">
                <div className="text-center max-w-md">
                  <svg className="mx-auto h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Pilih chat untuk mulai</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Pilih kontak dari daftar chat atau tambah kontak baru untuk mulai percakapan
                  </p>
                  <button
                    onClick={() => router.push('/contacts')}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-105"
                  >
                    <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Tambah Kontak
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl transform transition-all">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Hapus Pesan</h3>
            <p className="text-gray-500 mb-6">Yakin mau hapus pesan ini? Tindakan ini nggak bisa dibatalkan.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteMessage(deleteConfirm.messageId, deleteConfirm.telegramMessageId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all transform hover:scale-105"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-xl shadow-lg animate-pulse">
          {error}
        </div>
      )}
    </div>
  );
}
