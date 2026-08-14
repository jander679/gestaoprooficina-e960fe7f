import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, Bot, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

type Message = {
  id: string;
  text: string;
  sender: 'ai' | 'user';
};

export function OrionIA() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Olá! Sou a Órion-IA, sua assistente virtual. Como posso ajudar com o sistema hoje?',
      sender: 'ai',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // Mock AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Nesta versão, eu sou apenas uma demonstração visual do chat! Em breve serei integrada à IA nativa para ajudar você de verdade.',
        sender: 'ai',
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button className="flex flex-col items-center justify-center gap-1 group focus:outline-none hover:scale-105 transition-transform duration-200">
            <div className="w-16 h-16 rounded-full shadow-lg overflow-hidden bg-white border-2 border-primary/20 group-hover:border-primary flex items-center justify-center">
              <img 
                src="/orion-logo.jpg" 
                alt="Logo Órion-IA" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback icon if image fails to load
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('bg-primary/10');
                }}
              />
              {/* Fallback Icon */}
              <Bot className="w-8 h-8 text-primary absolute -z-10" />
            </div>
            <span className="text-xs font-bold text-primary bg-white/80 px-2 py-0.5 rounded-full shadow-sm backdrop-blur-sm border border-primary/10">
              Órion-IA
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[350px] p-0 mb-2 mr-2 shadow-xl border-primary/20" 
          sideOffset={10} 
          align="end"
        >
          <Card className="border-0 shadow-none">
            <CardHeader className="bg-primary/5 pb-4 rounded-t-lg border-b border-primary/10">
              <CardTitle className="flex items-center gap-2 text-primary text-lg">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white">
                  <img src="/orion-logo.jpg" alt="Logo" className="w-full h-full object-cover" />
                </div>
                Assistente Órion-IA
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px] p-4">
                <div className="flex flex-col gap-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 max-w-[85%] ${
                        msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
                      }`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {msg.sender === 'ai' ? (
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="w-3.5 h-3.5 text-primary" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div
                        className={`p-3 rounded-xl text-sm ${
                          msg.sender === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-none'
                            : 'bg-muted/50 text-foreground border rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="p-3 border-t bg-muted/20">
              <form 
                className="flex w-full gap-2 items-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
              >
                <Input
                  placeholder="Digite sua pergunta..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="bg-white"
                />
                <Button type="submit" size="icon" disabled={!inputValue.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </CardFooter>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
}
