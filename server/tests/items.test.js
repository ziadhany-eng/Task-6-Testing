// Backend tests for /api/items — THIS is the only backend file you edit.
// Run with:  npm test --workspace server
//
// tests/setup.js already starts an in-memory MongoDB and empties it after
// every test, so each test starts from a clean database.
import request from 'supertest';
import app from '../src/app.js';

// Helper: registers a user and returns their JWT.
// Use different names/emails when you need two users (e.g. for the 403 test).
async function registerAndGetToken(name = 'Alice', email = 'alice@test.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'secret123' });
  return res.body.token;
}

// Helper: creates an item as the user owning `token` and returns it.
// Override any field: createItem(token, { title: 'Keys', status: 'found' })
async function createItem(token, body = {}) {
  const res = await request(app)
    .post('/api/items')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library', ...body });
  return res.body.item;
}

describe('/api/items', () => {
  // Worked example — read it, then write the two tests below in the same style.
  test('GET is public and returns an empty list when there are no items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  test('POST returns 409 when the same title is reported at the same location twice', async () => {
    // Arrange: a logged-in user who has already reported "Black backpack" at "Library"
    const token = await registerAndGetToken();
    const first = await createItem(token);
    expect(first).toHaveProperty('_id'); // the first report really was saved

    // Act: report the same title at the same location again
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library' });

    // Assert: rejected as a duplicate, and only one item exists
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Duplicate item at this location');
    const list = await request(app).get('/api/items');
    expect(list.body.items).toHaveLength(1);
  });

  test('PATCH returns 403 when someone who is not the reporter edits the item', async () => {
    // Arrange: Alice reports an item, Bob is a different logged-in user
    const aliceToken = await registerAndGetToken('Alice', 'alice@test.com');
    const bobToken = await registerAndGetToken('Bob', 'bob@test.com');
    const item = await createItem(aliceToken);

    // Act: Bob tries to edit Alice's item
    const res = await request(app)
      .patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ title: 'Hacked title' });

    // Assert: forbidden, and the item is unchanged
    expect(res.status).toBe(403);
    const after = await request(app).get(`/api/items/${item._id}`);
    expect(after.body.item.title).toBe('Black backpack');
  });
});
