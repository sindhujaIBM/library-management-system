import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { adminClient } from '../api/client';

interface Message { role: 'user' | 'assistant'; content: string; }

export function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m your library AI assistant. Tell me what kind of books you enjoy, and I\'ll recommend titles from our collection.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = messages.slice(1); // skip the initial assistant greeting for context
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await adminClient.post('/ai/recommend', {
        message: text,
        conversationHistory: history,
      });
      setMessages(m => [...m, { role: 'assistant', content: res.data.data.reply }]);
    } catch (err: unknown) {
      const status = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { status?: number; data?: { error?: { message?: string } } } }).response?.status
        : null;
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
        : null;
      const text = status === 429
        ? (msg ?? 'Daily limit reached (5 recommendations per day). Come back tomorrow!')
        : 'Sorry, I ran into an error. Please try again.';
      setMessages(m => [...m, { role: 'assistant', content: text }]);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
      <div className="mb-4">
        <h1 className="text-2xl font-serif font-bold text-stone-900">Book Recommendations</h1>
        <p className="text-stone-500 text-sm">AI-powered suggestions from our collection</p>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-stone-100 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-stone-100 text-stone-800 rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="mt-1 mb-1 space-y-0.5 pl-4 list-disc">{children}</ul>,
                      ol: ({ children }) => <ol className="mt-1 mb-1 space-y-0.5 pl-4 list-decimal">{children}</ol>,
                      li: ({ children }) => <li className="leading-snug">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-stone-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-stone-100">
          <div className="flex gap-2">
            <input
              className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. I love mystery novels set in London…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
