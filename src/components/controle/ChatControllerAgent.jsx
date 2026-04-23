import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';

const AGENT_NAME = 'financial_controller';

export default function ChatControllerAgent() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef();

  useEffect(() => {
    async function init() {
      const conv = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: 'Controle de Produtos', description: 'Análise de compras e produtos' },
      });
      setConversation(conv);
    }
    init();
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsub();
  }, [conversation?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function enviar() {
    if (!input.trim() || !conversation || sending) return;
    setSending(true);
    const msg = input;
    setInput('');
    await base44.agents.addMessage(conversation, { role: 'user', content: msg });
    setSending(false);
  }

  return (
    <div className="bg-card rounded-xl border overflow-hidden flex flex-col h-[600px]">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center gap-2">
        <Bot className="w-5 h-5" />
        <div>
          <p className="text-sm font-bold">Financial Controller</p>
          <p className="text-[10px] opacity-90">Analise compras, variações de preço, fornecedores</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-8">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Pergunte algo como:</p>
            <p className="mt-2 italic">"Quais produtos tiveram maior variação de preço?"</p>
            <p className="italic">"Qual fornecedor concentra mais compras?"</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role !== 'user' && <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-indigo-600" /></div>}
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-muted'}`}>
              {m.role === 'user' ? (
                <p>{m.content}</p>
              ) : (
                <ReactMarkdown className="prose prose-sm prose-slate max-w-none [&>*]:my-1">{m.content || '...'}</ReactMarkdown>
              )}
            </div>
            {m.role === 'user' && <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center shrink-0"><User className="w-4 h-4 text-slate-600" /></div>}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && enviar()}
          placeholder="Pergunte ao Controller..."
          disabled={sending || !conversation}
        />
        <Button onClick={enviar} disabled={sending || !input.trim() || !conversation} size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}