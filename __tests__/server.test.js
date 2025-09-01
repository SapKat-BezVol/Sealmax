const request = require('supertest');
const { io } = require('socket.io-client');
const server = require('../server');

beforeAll(done => {
  server.listen(3000, done);
});

afterAll(done => {
  server.close(done);
});

test('serves index.html', async () => {
  const res = await request(server).get('/');
  expect(res.statusCode).toBe(200);
  expect(res.text).toContain('Sealmax Messenger');
  expect(res.text).toContain('Change name');
});

test('socket.io chat', done => {
  const client = io('http://localhost:3000');
  const message = { id: Date.now(), user: 'tester', text: 'hello' };

  client.on('connect', () => {
    client.emit('chat message', message);
  });

  client.on('chat message', msg => {
    expect(msg).toEqual(message);
    client.close();
    done();
  });
});
