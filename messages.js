const Router = require("express").Router;
const User = require("../models/user");
const {ensureLoggedIn, ensureCorrectUser} = require("../middleware/auth");

const router = new Router();

/** GET /:id - get detail of message.
 *
 * => {message: {id,
 *               body,
 *               sent_at,
 *               read_at,
 *               from_user: {username, first_name, last_name, phone},
 *               to_user: {username, first_name, last_name, phone}}
 *
 * Make sure that the currently-logged-in users is either the to or from user.
 *
 **/

router.get('/:id', async (req, res) => {
    const messageId = req.params.id;
    const username = req.user.username; 
  
    try {
      const queryText = `
        SELECT m.id, m.body, m.sent_at, m.read_at,
               fu.username AS from_username, fu.first_name AS from_first_name, fu.last_name AS from_last_name, fu.phone AS from_phone,
               tu.username AS to_username, tu.first_name AS to_first_name, tu.last_name AS to_last_name, tu.phone AS to_phone
        FROM messages m
        INNER JOIN users fu ON m.from_username = fu.username
        INNER JOIN users tu ON m.to_username = tu.username
        WHERE m.id = $1 AND (m.from_username = $2 OR m.to_username = $2)
      `;
      const result = await pool.query(queryText, [messageId, username]);
  
      if (result.rows.length === 0) {
        return res.status(404).send('No message available');
      }
  
      const message = result.rows[0];
      res.json({message});
    } catch (error) {
      console.error('Database Error', error);
      res.status(500).send('error');
    }
});
/** POST / - post message.
 *
 * {to_username, body} =>
 *   {message: {id, from_username, to_username, body, sent_at}}
 *
 **/


router.post('/', ensureLoggedIn, async (req, res) => {
    const { to_username, body } = req.body;
    const from_username = req.user.username;
  
    try {
        const insertQuery = `
          INSERT INTO messages (from_username, to_username, body, sent_at)
          VALUES ($1, $2, $3, NOW())
          RETURNING id, from_username, to_username, body, sent_at
        `;
        const result = await pool.query(insertQuery, [from_username, to_username, body]);
        const message = result.rows[0];
  
        res.status(201).json({message});
    } catch (error) {
        console.error('Error posting message', error);
        res.status(500).json({ error: 'error' });
    }
});
/** POST/:id/read - mark message as read:
 *
 *  => {message: {id, read_at}}
 *
 * Make sure that the only the intended recipient can mark as read.
 *
 **/

router.post('/:id/read', ensureLoggedIn, async (req, res) => {
    const messageId = req.params.id;
    const username = req.user.username; 

    try {
        const updateQuery = `
          UPDATE messages
          SET read_at = NOW()
          WHERE id = $1 AND to_username = $2
          RETURNING id, read_at
        `;
        const result = await pool.query(updateQuery, [messageId, username]);
  
        if (result.rows.length === 0) {
          return res.status(404).send('No Message');
        }
  
        const message = result.rows[0];
        res.json({message});
    } catch (error) {
        console.error('Could not mark as read', error);
        res.status(500).json({ error: 'error' });
    }
});