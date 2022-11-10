const express = require('express');
const {
  createCalendar,
  updateCalendar,
  deleteCalendar,
  shareCalendar,
  confirmCalendar,
  getInvitedUsers,
} = require('~/controllers/calendars');
const authenticate = require('~/middleware/auth');
const boundary = require('~/helpers/error-boundary');
const validate = require('~/helpers/validation');
const { createSchema, updateSchema, shareSchema } = require('~/validation/calendar');
const eventRouter = require('~/routes/event');

const router = express.Router();

router.use(authenticate);

router.post('/', validate(createSchema), boundary(createCalendar));

router.put('/:id', validate(updateSchema), boundary(updateCalendar));
router.delete('/:id', boundary(deleteCalendar));

router.get('/:id/invited', boundary(getInvitedUsers));
router.post('/:id/invite', validate(shareSchema), boundary(shareCalendar));
router.post('/invite-confirm/:token', boundary(confirmCalendar));

router.use('/:id/events', eventRouter);

module.exports = router;
