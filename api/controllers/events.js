const templates = require('~/consts/email');
const { ROLES } = require('~/consts/validation');
const { checkEventAction, checkCalendarAction } = require('~/helpers/action-checks');
const ServerError = require('~/helpers/server-error');
const { event, calendarEvents, userEvents, user, calendar } = require('~/lib/prisma');
const { Token, Email, Factory } = require('~/services');
const { getEventFilters, splitParams: split } = require('~/helpers/filtering');
const { reduceToConfirmed } = require('~/helpers/utils');

const getCalendarEvents = async (req, res) => {
  const userId = req.user.id;

  const { calendars, types } = req.query;
  const calendarIDs = split(calendars, Number);
  const typesArr = split(types, String);

  await Promise.all(
    calendarIDs.map((id) => {
      return checkCalendarAction(id, userId, Object.values(ROLES));
    }),
  );

  const filters = getEventFilters({
    types: typesArr,
    calendars: calendarIDs,
  });

  const events = await event.findMany({
    where: {
      users: {
        some: {
          user: { id: userId },
          isConfirmed: true,
        },
      },
      ...filters,
    },
    include: {
      calendars: {
        where: {
          calendarId: { in: calendarIDs },
        },
      },
      users: {
        select: { role: true },
        where: { userId },
      },
    },
  });

  const result = events.reduce(
    (prev, { users, calendars, ...curr }) => [
      ...prev,
      {
        ...curr,
        calendarId: calendars[0].calendarId,
        role: users[0].role,
      },
    ],
    [],
  );

  res.json(result);
};

const createEvent = async (req, res) => {
  const data = req.body;
  const calendarId = Number(req.params.id);
  const userId = req.user.id;
  const { admin, moderator } = ROLES;

  await checkCalendarAction(calendarId, userId, [admin, moderator]);

  if (!data.color) {
    const { color } = await Factory.findOne(calendar, calendarId);
    data.color = color;
  }

  const newEvent = await event.create({
    data: {
      ...data,
      users: {
        create: {
          role: ROLES.admin,
          user: { connect: { id: userId } },
        },
      },
      calendars: {
        create: {
          calendar: { connect: { id: calendarId } },
        },
      },
    },
  });

  const users = await user.findMany({
    where: {
      AND: {
        calendars: {
          some: { calendarId },
        },
        NOT: { id: userId },
      },
    },
  });

  await Promise.all(
    users.map(({ id }) =>
      Factory.update(event, newEvent.id, {
        users: {
          create: {
            role: ROLES.guest,
            user: {
              connect: { id },
            },
          },
        },
      }),
    ),
  );

  res.status(201).json(newEvent);
};

const deleteEvent = async (req, res) => {
  const calendarId = Number(req.params.id);
  const eventId = Number(req.params.eventId);
  const userId = req.user.id;
  const { admin, guest } = ROLES;

  await checkCalendarAction(calendarId, userId, Object.values(ROLES));
  const { role } = await checkEventAction(eventId, userId, [admin, guest]);

  if (role === admin) {
    await event.delete({ where: { id: eventId } });
  }

  if (role === guest) {
    await Promise.all([
      calendarEvents.delete({
        where: { calendarId_eventId: { calendarId, eventId } },
      }),
      userEvents.delete({
        where: { userId_eventId: { userId, eventId } },
      }),
    ]);
  }

  res.sendStatus(204);
};

const updateEvent = async (req, res) => {
  const data = req.body;
  const eventId = Number(req.params.eventId);
  const userId = req.user.id;

  await checkEventAction(eventId, userId, [ROLES.admin]);

  const updatedEvent = await event.update({
    where: { id: eventId },
    data,
  });

  res.status(201).json(updatedEvent);
};

const shareEvent = async (req, res) => {
  const eventId = Number(req.params.id);
  const { login, id } = req.user;
  const { email } = req.body;

  const { id: userId } = await Factory.exists(user, { email });

  await checkEventAction(eventId, id, [ROLES.admin]);

  const exists = await userEvents.findUnique({
    where: {
      userId_eventId: { userId, eventId },
    },
  });
  if (exists) {
    throw new ServerError(400, 'This user already has access to the event.');
  }

  await user.update({
    where: { id: userId },
    data: {
      events: {
        create: {
          role: ROLES.guest,
          isConfirmed: false,
          event: { connect: { id: eventId } },
        },
      },
    },
  });

  const token = Token.generateConfirmToken({ userId, eventId });
  await Email.sendMail(email, templates.EVENT_INVITE_CONFIRM, { login, token });

  res.sendStatus(204);
};

const confirmEvent = async (req, res) => {
  const { token } = req.params;
  const data = Token.validate(token);

  if (!data || !data.eventId || !data.userId) {
    throw new ServerError(400, 'The confirm token is invalid.');
  }
  const { userId, eventId } = data;

  const { id: calendarId } = await calendar.findFirst({
    where: {
      users: {
        some: {
          user: { id: userId },
          role: ROLES.moderator,
        },
      },
    },
  });

  await userEvents.update({
    where: { userId_eventId: { userId, eventId } },
    data: { isConfirmed: true },
  });

  await calendar.update({
    where: { id: calendarId },
    data: {
      events: {
        create: { event: { connect: { id: eventId } } },
      },
    },
  });

  res.sendStatus(204);
};

const getInvitedUsers = async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user.id;

  await checkEventAction(id, userId, Object.values(ROLES));

  const users = await user.findMany({
    where: {
      id: { not: userId },
      events: {
        some: {
          event: { id },
        },
      },
    },
    include: {
      events: {
        where: { eventId: id },
        select: { isConfirmed: true },
      },
    },
  });

  const result = reduceToConfirmed(users, 'events');

  res.json(result);
};

const getNotInvitedUsers = async (req, res) => {
  const id = Number(req.params.id);
  const userId = req.user.id;

  await checkEventAction(id, userId, Object.values(ROLES));

  const users = await user.findMany({
    where: {
      NOT: {
        events: {
          some: { eventId: id },
        },
      },
    },
    select: { id: true, email: true },
  });

  res.json(users);
};

module.exports = {
  getCalendarEvents,
  createEvent,
  deleteEvent,
  updateEvent,
  shareEvent,
  confirmEvent,
  getInvitedUsers,
  getNotInvitedUsers,
};
