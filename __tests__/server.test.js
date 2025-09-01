const request = require('supertest');
const { io } = require('socket.io-client');
const server = require('../server');

let httpServer;

beforeAll(done => {
  httpServer = server.listen(3000, done);
});

afterAll(done => {
  httpServer.close(done);
});

test('serves login page', async () => {
  const res = await request(httpServer).get('/');
  expect(res.statusCode).toBe(200);
  expect(res.text).toContain('Sign in');
});

test('register, login and chat', done => {
  const agent = request.agent(httpServer);
  agent
    .post('/api/register')
    .send({ username: 'u1', password: 'p1' })
    .then(() => agent.post('/api/login').send({ username: 'u1', password: 'p1' }))
    .then(res => {
      const cookie = res.headers['set-cookie'][0];
      const client = io('http://localhost:3000', { extraHeaders: { Cookie: cookie } });
      client.on('chat history', () => {
        client.emit('chat message', { recipientId: 0, text: 'hello' });
      });
      client.on('chat message', msg => {
        expect(msg.text).toBe('hello');
        client.close();
        done();
      });
    });
});
