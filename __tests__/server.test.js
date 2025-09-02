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
    .send({ username: 'u1', password: 'p1', customId: 'alpha1' })
    .then(() => agent.post('/api/login').send({ username: 'u1', password: 'p1' }))
    .then(res => {
      expect(res.body.customId).toBe('alpha1');
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

test('rejects invalid custom id', async () => {
  const res = await request(httpServer)
    .post('/api/register')
    .send({ username: 'u2', password: 'p2', customId: '1bad' });
  expect(res.statusCode).toBe(400);
});

test('fetch user by custom id', async () => {
  const agent = request.agent(httpServer);
  await agent.post('/api/register').send({ username: 'u3', password: 'p3', customId: 'alpha3' });
  await agent.post('/api/login').send({ username: 'u3', password: 'p3' });
  const res = await agent.get('/api/custom/alpha3');
  expect(res.body.username).toBe('u3');
});

test('contacts list only shows chatted users', done => {
  const agent1 = request.agent(httpServer);
  const agent2 = request.agent(httpServer);
  Promise.all([
    agent1.post('/api/register').send({ username: 'u4', password: 'p4', customId: 'alpha4' }),
    agent2.post('/api/register').send({ username: 'u5', password: 'p5', customId: 'alpha5' })
  ])
    .then(() => Promise.all([
      agent1.post('/api/login').send({ username: 'u4', password: 'p4' }),
      agent2.post('/api/login').send({ username: 'u5', password: 'p5' })
    ]))
    .then(([res1, res2]) => {
      const id2 = res2.body.id;
      const cookie1 = res1.headers['set-cookie'][0];
      const cookie2 = res2.headers['set-cookie'][0];
      const client1 = io('http://localhost:3000', { extraHeaders: { Cookie: cookie1 } });
      const client2 = io('http://localhost:3000', { extraHeaders: { Cookie: cookie2 } });
      client2.on('chat message', async () => {
        client1.close();
        client2.close();
        const c1 = await agent1.get('/api/contacts');
        const c2 = await agent2.get('/api/contacts');
        expect(c1.body.some(u => u.username === 'u5')).toBe(true);
        expect(c2.body.some(u => u.username === 'u4')).toBe(true);
        done();
      });
      client1.on('chat history', () => {
        client1.emit('chat message', { recipientId: id2, text: 'hi' });
      });
    });
});

test('rejects duplicate usernames', async () => {
  const agent = request.agent(httpServer);
  await agent
    .post('/api/register')
    .send({ username: 'dup', password: 'p', customId: 'alphadup' });
  const res = await agent
    .post('/api/register')
    .send({ username: 'DuP', password: 'p2', customId: 'alphadup2' });
  expect(res.statusCode).toBe(400);
  expect(JSON.parse(res.text).error).toBe('user exists');
});

test('login is case insensitive', async () => {
  const agent = request.agent(httpServer);
  await agent
    .post('/api/register')
    .send({ username: 'CaseUser', password: 'pass', customId: 'alpha8' });
  const res = await agent
    .post('/api/login')
    .send({ username: 'caseuser', password: 'pass' });
  expect(res.statusCode).toBe(200);
  expect(res.body.username).toBe('CaseUser');
});
