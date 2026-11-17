const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
process.env.JWT_SECRET = 'test-secret-used-only-in-tests-123456789';
const User = require('../src/models/User');
const app = require('../src/app');
const originals = { exists: User.exists, create: User.create, findOne: User.findOne, findById: User.findById, find: User.find };
afterEach(() => Object.assign(User, originals));
const id = '507f1f77bcf86cd799439011';

test('registration hashes password, normalizes email and never returns the hash', async () => {
  User.exists = async () => false;
  let stored;
  User.create = async data => { stored = data; return new User({ ...data, _id: id }); };
  const response = await request(app).post('/api/auth/register').send({ username: ' Tiến ', email: ' TIEN@example.com ', password: 'password123' });
  assert.equal(response.status, 201);
  assert.equal(stored.email, 'tien@example.com');
  assert.equal(stored.username, 'Tiến');
  assert.equal(await bcrypt.compare('password123', stored.passwordHash), true);
  assert.equal(response.body.user.passwordHash, undefined);
  assert.equal(jwt.verify(response.body.token, process.env.JWT_SECRET).sub, id);
});

test('duplicate email, duplicate index race, and invalid registration are rejected', async () => {
  const body = { username: 'Tien', email: 'tien@example.com', password: 'password123' };
  User.exists = async () => true;
  assert.equal((await request(app).post('/api/auth/register').send(body)).status, 409);
  User.exists = async () => false;
  User.create = async () => { throw Object.assign(new Error(), { code: 11000 }); };
  assert.equal((await request(app).post('/api/auth/register').send(body)).status, 409);
  assert.equal((await request(app).post('/api/auth/register').send({ ...body, password: 'short' })).status, 400);
  assert.equal((await request(app).post('/api/auth/register').send({ ...body, password: '🙂'.repeat(20) })).status, 400);
});

test('login rejects wrong password and returns a JWT for correct password', async () => {
  const user = new User({ _id: id, username: 'Tien', email: 'tien@example.com', passwordHash: await bcrypt.hash('password123', 4) });
  user.save = async () => user;
  User.findOne = () => ({ select: async () => user });
  assert.equal((await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong' })).status, 401);
  const response = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  assert.equal(response.body.user.passwordHash, undefined);
});

test('private routes reject missing, invalid, expired tokens and deleted accounts', async () => {
  assert.equal((await request(app).get('/api/users/me')).status, 401);
  assert.equal((await request(app).get('/api/users/me').auth('invalid', { type: 'bearer' })).status, 401);
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: id, expiresIn: -1, issuer: 'ptitchat', audience: 'ptitchat-client' });
  assert.equal((await request(app).get('/api/users/me').auth(token, { type: 'bearer' })).status, 401);
  User.findById = async () => null;
  const valid = jwt.sign({}, process.env.JWT_SECRET, { subject: id, issuer: 'ptitchat', audience: 'ptitchat-client' });
  assert.equal((await request(app).get('/api/users/me').auth(valid, { type: 'bearer' })).status, 401);
});

test('profile protects sensitive fields and search treats regex characters literally', async () => {
  const user = new User({ _id: id, username: 'Tien', email: 'tien@example.com', passwordHash: 'hidden' });
  user.save = async () => { await user.validate(); return user; };
  User.findById = async () => user;
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: id, issuer: 'ptitchat', audience: 'ptitchat-client' });
  const api = (method, path) => request(app)[method](path).auth(token, { type: 'bearer' });
  assert.equal((await api('get', '/api/users/me')).body.user.passwordHash, undefined);
  assert.equal((await api('put', '/api/users/me').send({ passwordHash: 'hack' })).status, 400);
  assert.equal((await api('put', '/api/users/me').send({ avatar: 'javascript:alert(1)' })).status, 400);
  assert.equal((await api('put', '/api/users/me').send({ bio: 'Xin chào' })).body.user.bio, 'Xin chào');
  assert.equal((await api('get', '/api/users/search?q=')).status, 400);
  let filter;
  User.find = value => { filter = value; return { select: () => ({ sort: () => ({ limit: async () => [] }) }) }; };
  assert.equal((await api('get', '/api/users/search?q=a.*')).status, 200);
  assert.equal(filter.$or[0].username.$regex, 'a\\.\\*');
});
