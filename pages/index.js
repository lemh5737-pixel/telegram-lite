import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const [telegramApiKey, setTelegramApiKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const checkLoginStatus = async () => {
      try {
        const response = await fetch('/api/botToken');
        if (response.ok) {
          const data = await response.json();
          if (data.token) {
            router.push('/chat');
          }
        }
      } catch (err) {
        console.error('Error checking login status:', err);
      }
    };
    
    checkLoginStatus();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!telegramApiKey) {
      setError('Telegram Bot API Key is required');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Save the token to GitHub database
      const configResponse = await fetch('/api/config');
      const { repo } = await configResponse.json();
      
      const chatsResponse = await fetch('/api/chats');
      const chats = await chatsResponse.json();
      
      // Add token as a special message
      const tokenMessage = {
        id: chats.length + 1,
        chatId: 0, // Special chat ID for system messages
        user: 'System',
        username: 'system',
        text: `/settoken ${telegramApiKey}`,
        from: 'user',
        timestamp: new Date().toISOString()
      };
      
      const updatedChats = [...chats, tokenMessage];
      
      await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chats: updatedChats }),
      });
      
      // Redirect to chat page
      router.push('/chat');
    } catch (err) {
      console.error('Error saving token:', err);
      setError('Failed to save API key');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-md">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Telegram Lite
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your Telegram Bot API Key to get started
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="telegram-api-key" className="sr-only">
                Telegram Bot API Key
              </label>
              <input
                id="telegram-api-key"
                name="telegramApiKey"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Telegram Bot API Key"
                value={telegramApiKey}
                onChange={(e) => setTelegramApiKey(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save API Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
    }
