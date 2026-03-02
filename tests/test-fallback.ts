import { multiAI } from '../utils/multi-ai';

async function testFallback() {
    console.log('--- Testing MultiAI Fallback ---');

    // Corrupt Groq key to force fallback
    process.env.GROQ_API_KEY = 'invalid_key';
    console.log('MOCKED: GROQ_API_KEY set to invalid.');

    // Simulate a set of messages
    const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'Say hello.' }
    ];

    try {
        console.log('Calling chat...');
        const res = await multiAI.chat(messages, { stream: false });

        if (res.ok) {
            const data = await res.json();
            console.log('Success!');
            console.log('Provider Response:', data.choices[0].message.content);
            console.log('Check lib/ai/state.json for persisted provider.');
        } else {
            console.error('Response not OK:', res.status, await res.text());
        }
    } catch (err) {
        console.error('Test failed:', err);
    }
}

testFallback();
