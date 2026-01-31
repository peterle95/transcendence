"use client";

import { useState } from 'react';

type ServiceStatus = 'idle' | 'loading' | 'success' | 'error';
type ServiceResponse = {
    status: number;
    data: any;
};

export default function TestDashboard() {
    const [authStatus, setAuthStatus] = useState<ServiceStatus>('idle');
    const [chatStatus, setChatStatus] = useState<ServiceStatus>('idle');
    const [gameStatus, setGameStatus] = useState<ServiceStatus>('idle');

    const [authResponse, setAuthResponse] = useState<ServiceResponse | null>(null);
    const [chatResponse, setChatResponse] = useState<ServiceResponse | null>(null);
    const [gameResponse, setGameResponse] = useState<ServiceResponse | null>(null);

    const testService = async (
        url: string,
        setStatus: (s: ServiceStatus) => void,
        setResponse: (r: ServiceResponse | null) => void
    ) => {
        setStatus('loading');
        setResponse(null);
        try {
            const res = await fetch(url);
            const data = await res.json().catch(() => ({ error: 'Invalid JSON' }));
            setStatus(res.ok ? 'success' : 'error');
            setResponse({ status: res.status, data });
        } catch (error: any) {
            setStatus('error');
            setResponse({ status: 0, data: { error: error.message } });
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <h1 className="text-4xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                Service Connectivity Dashboard
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {/* Auth Service */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-all">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-blue-400">Auth Service</h2>
                        <div className={`w-3 h-3 rounded-full ${authStatus === 'success' ? 'bg-green-500' :
                                authStatus === 'error' ? 'bg-red-500' :
                                    authStatus === 'loading' ? 'bg-yellow-500' : 'bg-gray-500'
                            }`} />
                    </div>
                    <p className="text-gray-400 text-sm mb-4">Port: 3000 (Internal)</p>
                    <button
                        onClick={() => testService('/api/test/auth', setAuthStatus, setAuthResponse)}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors mb-4"
                        disabled={authStatus === 'loading'}
                    >
                        {authStatus === 'loading' ? 'Testing...' : 'Test Connection'}
                    </button>
                    {authResponse && (
                        <div className="bg-gray-900 p-3 rounded font-mono text-xs overflow-auto max-h-40">
                            <div className="mb-1 text-gray-500">Status: {authResponse.status}</div>
                            <pre>{JSON.stringify(authResponse.data, null, 2)}</pre>
                        </div>
                    )}
                </div>

                {/* Chat Service */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-green-500 transition-all">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-green-400">Chat Service</h2>
                        <div className={`w-3 h-3 rounded-full ${chatStatus === 'success' ? 'bg-green-500' :
                                chatStatus === 'error' ? 'bg-red-500' :
                                    chatStatus === 'loading' ? 'bg-yellow-500' : 'bg-gray-500'
                            }`} />
                    </div>
                    <p className="text-gray-400 text-sm mb-4">Port: 3001 (Internal)</p>
                    <button
                        onClick={() => testService('/api/test/chat', setChatStatus, setChatResponse)}
                        className="w-full py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors mb-4"
                        disabled={chatStatus === 'loading'}
                    >
                        {chatStatus === 'loading' ? 'Testing...' : 'Test Connection'}
                    </button>
                    {chatResponse && (
                        <div className="bg-gray-900 p-3 rounded font-mono text-xs overflow-auto max-h-40">
                            <div className="mb-1 text-gray-500">Status: {chatResponse.status}</div>
                            <pre>{JSON.stringify(chatResponse.data, null, 2)}</pre>
                        </div>
                    )}
                </div>

                {/* Game Service */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-purple-400">Game Service</h2>
                        <div className={`w-3 h-3 rounded-full ${gameStatus === 'success' ? 'bg-green-500' :
                                gameStatus === 'error' ? 'bg-red-500' :
                                    gameStatus === 'loading' ? 'bg-yellow-500' : 'bg-gray-500'
                            }`} />
                    </div>
                    <p className="text-gray-400 text-sm mb-4">Port: 3002 (Internal)</p>
                    <button
                        onClick={() => testService('/api/test/game', setGameStatus, setGameResponse)}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors mb-4"
                        disabled={gameStatus === 'loading'}
                    >
                        {gameStatus === 'loading' ? 'Testing...' : 'Test Connection'}
                    </button>
                    {gameResponse && (
                        <div className="bg-gray-900 p-3 rounded font-mono text-xs overflow-auto max-h-40">
                            <div className="mb-1 text-gray-500">Status: {gameResponse.status}</div>
                            <pre>{JSON.stringify(gameResponse.data, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
