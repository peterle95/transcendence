import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

function createClient(userId: number): Socket {
  return io(SERVER_URL, {
    path: '/socket.io',
    extraHeaders: {
      'x-mock-user-id': String(userId)
    },
    auth: {
      userId: String(userId)
    },
    transports: ['websocket']
  });
}

async function runTests() {
  console.log('Starting WebSocket Integration Tests...');

  const client1 = createClient(1);
  const client2 = createClient(2);

  const testPromise = new Promise<void>((resolve, reject) => {
    let messageReceived = false;
    let messageSent = false;

    // Timeout to fail test if not completed
    const timeout = setTimeout(() => {
      reject(new Error('Test timed out'));
    }, 5000);

    client1.on('connect', () => {
      console.log('Client 1 connected');
    });

    client2.on('connect', () => {
      console.log('Client 2 connected');
      
      // Once both are connected (implied by this firing), send message from Client 1
      // Give a slight delay to ensure Client 1 is also ready
      setTimeout(() => {
        console.log('Client 1 sending message to Client 2...');
        client1.emit('send_message', {
            receiverId: 2,
            content: 'Hello from Client 1'
        });
      }, 500);
    });

    client1.on('message_sent', (data) => {
      console.log('Client 1 received message_sent confirmation:', data);
      messageSent = true;
      checkDone();
    });

    client2.on('new_message', (data) => {
        console.log('Client 2 received new_message:', data);
        if (data.content === 'Hello from Client 1' && data.sender_id === 1) {
            messageReceived = true;
        }
        checkDone();
    });

    function checkDone() {
        if (messageReceived && messageSent) {
            clearTimeout(timeout);
            resolve();
        }
    }
  });

  try {
    await testPromise;
    console.log(' TEST PASSED: Message sent and received successfully.');
  } catch (error) {
    console.error(' TEST FAILED:', error);
  } finally {
    client1.disconnect();
    client2.disconnect();
  }
}

runTests();
