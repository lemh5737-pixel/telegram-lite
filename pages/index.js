import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const [telegramApiKey, setTelegramApiKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in (has token in localStorage)
    const savedToken = localStorage.getItem('telegramApiKey');
    if (savedToken) {
      router.push('/contacts');
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!telegramApiKey) {
      setError('Telegram Bot API Key is required');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
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
      
      // Save to GitHub
      const saveResponse = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chats: updatedChats }),
      });
      
      if (!saveResponse.ok) {
        throw new Error('Failed to save token to GitHub');
      }
      
      // Save token to localStorage
      localStorage.setItem('telegramApiKey', telegramApiKey);
      
      // Redirect to contacts page
      router.push('/contacts');
    } catch (err) {
      console.error('Error saving token:', err);
      setError('Failed to save API key. Please try again.');
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
                disabled={isLoading}
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
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : 'Save API Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
